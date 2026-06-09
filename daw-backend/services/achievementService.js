const sequelize = require("../config/database");
const Achievement = require("../models/Achievement");
const NewsArticle = require("../models/NewsArticle");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { autoTranslate } = require("./openaiService");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("./erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");
const { saveManualTranslations } = require("../utils/translationHelper");
const { handleEditorStaging } = require("../utils/editorHelper");

const MODULE_NAME = "Achievement";
const NOTRANS_PREFIX = "ACM";

class AchievementService {
  /**
   * Helper to normalize user roles.
   */
  getRole(userRole) {
    return userRole ? userRole.toLowerCase().trim() : "";
  }

  /**
   * Retrieve all achievements ordered by year and ID with lazy translation support.
   */
  async getAllAchievements(lang = "en") {
    const achievements = await Achievement.findAll({
      include: [
        {
          model: NewsArticle,
          as: "newsArticle",
          attributes: ["id", "title", "slug", "status"],
          required: false,
        },
      ],
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) > 0 
              FROM ApprovalDrafts 
              WHERE ApprovalDrafts.target_id = Achievement.id COLLATE utf8mb4_unicode_ci 
              AND ApprovalDrafts.module_name = '${MODULE_NAME}' 
              AND ApprovalDrafts.status = 'Rejected'
            )`),
            "hasRejected",
          ],
        ],
      },
      order: [
        ["year", "DESC"],
        ["id", "DESC"],
      ],
    });

    const formattedData = achievements.map((m) => {
      const item = m.toJSON();
      item.hasRejected = !!item.hasRejected;
      return item;
    });

    if (lang === "en") {
      return formattedData;
    }

    // Lazy Translation Pipeline
    const safeTranslate = async (moduleName, id, field, sourceValue) => {
      let transRecord = await Translation.findOne({ where: { modelName: moduleName, recordId: String(id), field, locale: "id" } });
      if (!sourceValue || !String(sourceValue).trim()) {
        if (transRecord) await transRecord.destroy();
        return sourceValue;
      }
      if (!transRecord) {
        const fresh = await autoTranslate(sourceValue, "Indonesian");
        if (fresh) await Translation.create({ modelName: moduleName, recordId: String(id), field, locale: "id", translatedText: fresh });
        return fresh || sourceValue;
      }
      return transRecord.translatedText;
    };

    const translatedAchievements = [];
    for (let i = 0; i < formattedData.length; i++) {
      let item = formattedData[i];
      item.title = await safeTranslate(MODULE_NAME, item.id, "title", item.title);
      item.description = await safeTranslate(MODULE_NAME, item.id, "description", item.description);
      translatedAchievements.push(item);
    }

    return translatedAchievements;
  }

  /**
   * Retrieve a specific achievement by primary key.
   */
  async getAchievementById(id) {
    const achievement = await Achievement.findByPk(id);
    if (!achievement) {
      throw new Error("NOT_FOUND: Achievement not found.");
    }
    return achievement;
  }

  /**
   * Create a new achievement record with optional staging and locking.
   */
  async createAchievement({ req, res, body, file, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = this.getRole(userRole);
      const { year, title, category, iconId, date, description, status, news_article_id } = body;

      const imageUrl = file ? file.filename : null;
      const isEditor = normalizedRole === "editor" && status === "Published";

      const newAchievement = await Achievement.create(
        {
          year,
          title,
          category,
          iconId: iconId || "star",
          date,
          description,
          imageUrl,
          news_article_id: news_article_id || null,
          is_locked: isEditor,
          lock_ticket: null,
        },
        { transaction: t },
      );

      if (isEditor) {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: NOTRANS_PREFIX,
          action: "CREATE",
          targetId: String(newAchievement.id),
          payload: {
            year, title, category,
            iconId: iconId || "star",
            date, description, imageUrl,
            status: "Published",
            _translations: body._translations,
          },
          recordToLock: newAchievement,
          successMessage: "Penghargaan baru diajukan ke ERP OWL.",
        });
      }

      await saveManualTranslations(MODULE_NAME, newAchievement.id, body._translations, t);
      await t.commit();
      return { success: true, isDraft: false, data: newAchievement };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      if (file) deleteSingleFile(file.filename);
      throw error;
    }
  }

  /**
   * Update an existing achievement, handling locking guards and media swaps.
   */
  async updateAchievement({ req, res, id, body, file, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = this.getRole(userRole);
      const { year, title, category, iconId, date, description, removePhoto, status, previous_notrans, news_article_id } = body;

      const achievement = await Achievement.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!achievement) {
        throw new Error("NOT_FOUND: Achievement not found.");
      }

      if (achievement.is_locked && normalizedRole === "editor") {
        throw new Error(`LOCKED: tiket ${achievement.lock_ticket}`);
      }

      // Handle photo updates or removals
      let finalImageUrl = achievement.imageUrl;
      let oldImageToDelete = null;

      if (file) {
        oldImageToDelete = achievement.imageUrl;
        finalImageUrl = file.filename;
      } else if (removePhoto === "true" || removePhoto === true) {
        oldImageToDelete = achievement.imageUrl;
        finalImageUrl = null;
      }

      const payload = {
        year: year || achievement.year,
        title: title || achievement.title,
        category: category || achievement.category,
        iconId: iconId || achievement.iconId,
        date: date || achievement.date,
        description: description || achievement.description,
        imageUrl: finalImageUrl,
        news_article_id: news_article_id !== undefined ? (news_article_id || null) : achievement.news_article_id,
      };

      const isEditor = normalizedRole === "editor" && status === "Published";

      if (isEditor) {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: NOTRANS_PREFIX,
          action: "UPDATE",
          targetId: String(id),
          payload: { ...payload, status: "Published", _translations: body._translations },
          recordToLock: achievement,
          previousNotrans: previous_notrans,
          successMessage: "Revisi penghargaan diajukan ke ERP OWL.",
        });
      }

      // Admin path
      await ApprovalDraft.update(
        { status: "Obsolete" },
        {
          where: {
            module_name: MODULE_NAME,
            target_id: String(id),
            status: ["Pending", "Rejected"],
          },
          transaction: t,
        },
      );

      await achievement.update(
        { ...payload, is_locked: false, lock_ticket: null },
        { transaction: t },
      );
      
      await saveManualTranslations(MODULE_NAME, id, body._translations, t);

      await t.commit();

      if (oldImageToDelete) deleteSingleFile(oldImageToDelete);

      return { success: true, isDraft: false, data: achievement };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      if (file) deleteSingleFile(file.filename);
      throw error;
    }
  }

  /**
   * Delete achievement permanently or stage a deletion draft.
   */
  async deleteAchievement({ req, res, id, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = this.getRole(userRole);
      const achievement = await Achievement.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!achievement) {
        throw new Error("NOT_FOUND: Achievement not found.");
      }

      if (achievement.is_locked && normalizedRole === "editor") {
        throw new Error(`LOCKED: tiket ${achievement.lock_ticket}`);
      }

      const imageToDelete = achievement.imageUrl;

      if (normalizedRole === "editor") {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: NOTRANS_PREFIX,
          action: "DELETE",
          targetId: String(id),
          payload: {
            year: achievement.year,
            title: achievement.title,
            imageUrl: achievement.imageUrl,
          },
          recordToLock: achievement,
          successMessage: "Permintaan hapus penghargaan diajukan ke ERP OWL.",
        });
      }

      // Admin path
      await invalidateOldDrafts(MODULE_NAME, id, t);
      await achievement.destroy({ transaction: t });
      await Translation.destroy({ where: { modelName: MODULE_NAME, recordId: String(id) }, transaction: t });
      await t.commit();

      if (imageToDelete) deleteSingleFile(imageToDelete);

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new AchievementService();
