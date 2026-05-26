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
    const translatedAchievements = [];
    for (let i = 0; i < formattedData.length; i++) {
      let item = formattedData[i];
      
      let titleTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field: "title", locale: "id" } });
      let descTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field: "description", locale: "id" } });
      
      const needsTitleTrans = item.title && !titleTrans;
      const needsDescTrans = item.description && !descTrans;

      if (needsTitleTrans || needsDescTrans) {
        // console.log(`[Lazy Translation] Translating Achievement: ${item.id}...`);
        const freshTitle = needsTitleTrans ? await autoTranslate(item.title, "Indonesian") : "";
        const freshDesc = needsDescTrans ? await autoTranslate(item.description, "Indonesian") : "";
        
        const upsertAchvTrans = async (field, translatedText) => {
          if (!translatedText) return;
          const existing = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field, locale: "id" } });
          if (existing) await existing.update({ translatedText });
          else await Translation.create({ modelName: MODULE_NAME, recordId: String(item.id), field, locale: "id", translatedText });
        };

        if (freshTitle) { await upsertAchvTrans("title", freshTitle); item.title = freshTitle; }
        if (freshDesc) { await upsertAchvTrans("description", freshDesc); item.description = freshDesc; }
      } else {
        if (titleTrans) item.title = titleTrans.translatedText;
        if (descTrans) item.description = descTrans.translatedText;
      }
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
  async createAchievement({ body, file, userRole, actorId, karyawanId, owlToken }) {
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
        const notrans = await generateNotrans(NOTRANS_PREFIX);

        await ApprovalDraft.create(
          {
            notrans,
            module_name: MODULE_NAME,
            target_id: String(newAchievement.id),
            action: "CREATE",
            payload: {
              year,
              title,
              category,
              iconId: iconId || "star",
              date,
              description,
              imageUrl,
              status: "Published",
            },
            created_by: actorId,
            status: "Pending",
          },
          { transaction: t },
        );

        await newAchievement.update({ lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({
            notrans,
            moduleName: MODULE_NAME,
            karyawanId: karyawanId,
            token: owlToken,
          });
        } catch (owlError) {
          console.error(`🚨 [ERP SYNC FAILED] Ticket ${notrans}:`, owlError.message);
        }

        return { success: true, isDraft: true, ticket: notrans };
      }

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
  async updateAchievement({ id, body, file, userRole, actorId, karyawanId, owlToken }) {
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
        const notrans = await generateNotrans(NOTRANS_PREFIX);
        const ticketToClear = previous_notrans || achievement.lock_ticket;

        if (ticketToClear) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            {
              where: { notrans: ticketToClear, module_name: MODULE_NAME },
              transaction: t,
            },
          );
        }

        await ApprovalDraft.create(
          {
            notrans,
            module_name: MODULE_NAME,
            target_id: String(id),
            action: "UPDATE",
            payload: { ...payload, status: "Published" },
            created_by: actorId,
            status: "Pending",
          },
          { transaction: t },
        );

        await achievement.update(
          { is_locked: true, lock_ticket: notrans },
          { transaction: t },
        );

        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({
            notrans,
            moduleName: MODULE_NAME,
            karyawanId: karyawanId,
            token: owlToken,
          });
        } catch (owlError) {
          console.error(`🚨 [ERP SYNC FAILED] Ticket ${notrans}:`, owlError.message);
        }

        return { success: true, isDraft: true, ticket: notrans };
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
  async deleteAchievement({ id, userRole, actorId, karyawanId, owlToken }) {
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
        const notrans = await generateNotrans(NOTRANS_PREFIX);

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

        await ApprovalDraft.create(
          {
            notrans,
            module_name: MODULE_NAME,
            target_id: String(id),
            action: "DELETE",
            payload: {
              year: achievement.year,
              title: achievement.title,
              imageUrl: achievement.imageUrl,
            },
            created_by: actorId,
            status: "Pending",
          },
          { transaction: t },
        );

        await achievement.update(
          { is_locked: true, lock_ticket: notrans },
          { transaction: t },
        );

        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({
            notrans,
            moduleName: MODULE_NAME,
            karyawanId: karyawanId,
            token: owlToken,
          });
        } catch (e) {
          console.error(`🚨 [ERP SYNC FAILED] Ticket ${notrans}:`, e.message);
        }

        return { success: true, isDraft: true, ticket: notrans };
      }

      // Admin path
      await invalidateOldDrafts(MODULE_NAME, id, t);
      await achievement.destroy({ transaction: t });
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
