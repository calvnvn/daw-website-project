const sequelize = require("../config/database");
const InvestmentSettings = require("../models/InvestmentSettings");
const Affiliate = require("../models/Affiliate");
const AffiliateCategory = require("../models/AffiliateCategory");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { deleteSingleFile } = require("../utils/fileRemover");
const { generateNotrans } = require("../utils/notransGenerator");
const { saveManualTranslations } = require("../utils/translationHelper");
const ErpApprovalService = require("./erpApprovalService");
const { autoTranslate } = require("./openaiService");

class InvestmentService {
  async processInvestmentPayload(body, existingData = {}) {
    const { teaserHeadline, teaserBody, sectionIntro } = body;
    return {
      payload: {
        teaserHeadline: teaserHeadline || existingData.teaserHeadline,
        teaserBody: teaserBody || existingData.teaserBody,
        sectionIntro: sectionIntro || existingData.sectionIntro,
      },
      filesToDelete: [],
    };
  }

  async processAffiliatePayload(body, file, existingData = {}) {
    const { name, desc, category_id, websiteUrl, removePhoto } = body;
    let filesToDelete = [];
    let finalLogoUrl = existingData.logoUrl || null;

    if (file) {
      if (existingData.logoUrl) filesToDelete.push(existingData.logoUrl);
      finalLogoUrl = file.filename;
    } else if (removePhoto === "true" || removePhoto === true) {
      if (existingData.logoUrl) filesToDelete.push(existingData.logoUrl);
      finalLogoUrl = null;
    }

    return {
      payload: {
        name: name || existingData.name,
        desc: desc || existingData.desc,
        category_id: category_id !== undefined ? (category_id || null) : existingData.category_id,
        websiteUrl: websiteUrl !== undefined ? websiteUrl : existingData.websiteUrl,
        logoUrl: finalLogoUrl,
      },
      filesToDelete,
    };
  }

  // ==========================================
  // CATEGORY CRUD OPERATIONS
  // ==========================================

  async getAllCategories() {
    return AffiliateCategory.findAll({
      order: [["name", "ASC"]],
      include: [{
        model: Affiliate,
        as: "affiliates",
        attributes: ["id"],
      }],
    });
  }

  async createCategory({ userRole, body, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { name, description, icon } = body;
      if (!name || !name.trim()) {
        await t.rollback();
        throw new Error("NOT_FOUND: Nama kategori tidak boleh kosong");
      }

      const newCategory = await AffiliateCategory.create(
        { name: name.trim(), description: description || null, icon: icon || "Briefcase", is_locked: false },
        { transaction: t },
      );

      await t.commit();
      return { success: true, isDraft: false, data: newCategory };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateCategory({ id, userRole, body, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const category = await AffiliateCategory.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!category) {
        await t.rollback();
        throw new Error("NOT_FOUND: Kategori tidak ditemukan");
      }

      const { name, description, icon } = body;
      await category.update(
        {
          name: name !== undefined ? name.trim() : category.name,
          description: description !== undefined ? description : category.description,
          icon: icon !== undefined ? icon : category.icon,
        },
        { transaction: t },
      );

      // 🧹 Bersihkan cache terjemahan
      await Translation.destroy({ where: { modelName: "AffiliateCategory", recordId: String(id) }, transaction: t });
      await t.commit();
      return { success: true, isDraft: false, data: category };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteCategory({ id, userRole }) {
    const t = await sequelize.transaction();
    try {
      const category = await AffiliateCategory.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!category) {
        await t.rollback();
        throw new Error("NOT_FOUND: Kategori tidak ditemukan");
      }

      // Cek apakah masih ada affiliate yang terhubung
      const affiliateCount = await Affiliate.count({ where: { category_id: id }, transaction: t });
      if (affiliateCount > 0) {
        await t.rollback();
        throw new Error(`NOT_FOUND: Tidak bisa menghapus. Masih ada ${affiliateCount} perusahaan terhubung di kategori ini.`);
      }

      await category.destroy({ transaction: t });
      // 🧹 Bersihkan cache terjemahan
      await Translation.destroy({ where: { modelName: "AffiliateCategory", recordId: String(id) }, transaction: t });
      await t.commit();
      return { success: true };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  // ==========================================
  // PUBLIC DATA (with Translation)
  // ==========================================

  async getPublicInvestmentData(lang = "en") {
    let settings = await InvestmentSettings.findByPk(1);
    if (!settings) {
      try {
        settings = await InvestmentSettings.create({
          id: 1, teaserHeadline: "Other Investments.", teaserBody: "Beyond our core operations...", sectionIntro: "We continuously look for opportunities...", is_locked: false,
        });
      } catch (err) {
        settings = await InvestmentSettings.findByPk(1);
      }
    }

    // Fetch categories with their affiliated companies
    const categories = await AffiliateCategory.findAll({
      order: [["name", "ASC"]],
      include: [{
        model: Affiliate,
        as: "affiliates",
        attributes: ["id", "name", "desc", "logoUrl", "websiteUrl", "is_locked"],
        where: { is_locked: false },
        required: false,
      }],
    });

    // Filter out draft-created affiliates
    const createDrafts = await ApprovalDraft.findAll({
      where: { module_name: "Affiliate", action: "CREATE", status: "Pending" },
    });
    const newDraftIds = new Set(createDrafts.map((d) => String(d.target_id)));

    // Build nested structure: categories -> companies
    const nestedCategories = categories.map((cat) => {
      const plain = cat.get({ plain: true });
      plain.affiliates = (plain.affiliates || []).filter((a) => !newDraftIds.has(String(a.id)));
      return plain;
    });

    if (lang === "en") return { settings, categories: nestedCategories };

    // === TRANSLATION PIPELINE ===
    const safeTranslate = async (moduleName, id, field, sourceValue) => {
      let transRecord = await Translation.findOne({ where: { modelName: moduleName, recordId: String(id), field, locale: "id" } });
      if (!sourceValue || !String(sourceValue).trim()) {
        if (transRecord) {
          await transRecord.destroy();
        }
        return sourceValue;
      }
      if (!transRecord) {
        const fresh = await autoTranslate(sourceValue, "Indonesian");
        if (fresh) {
          await Translation.create({ modelName: moduleName, recordId: String(id), field, locale: "id", translatedText: fresh });
        }
        return fresh || sourceValue;
      }
      return transRecord.translatedText;
    };

    let plainSettings = settings.get({ plain: true });
    plainSettings.teaserHeadline = await safeTranslate("InvestmentSettings", "1", "teaserHeadline", plainSettings.teaserHeadline);
    plainSettings.teaserBody = await safeTranslate("InvestmentSettings", "1", "teaserBody", plainSettings.teaserBody);
    plainSettings.sectionIntro = await safeTranslate("InvestmentSettings", "1", "sectionIntro", plainSettings.sectionIntro);

    for (let i = 0; i < nestedCategories.length; i++) {
      const cat = nestedCategories[i];
      cat.name = await safeTranslate("AffiliateCategory", cat.id, "name", cat.name);
      cat.description = await safeTranslate("AffiliateCategory", cat.id, "description", cat.description);

      for (let j = 0; j < (cat.affiliates || []).length; j++) {
        const company = cat.affiliates[j];
        company.desc = await safeTranslate("Affiliate", company.id, "desc", company.desc);
      }
    }

    return { settings: plainSettings, categories: nestedCategories };
  }

  // ==========================================
  // ADMIN DATA (CMS)
  // ==========================================

  async getAdminInvestmentData() {
    let settings = await InvestmentSettings.findByPk(1);
    if (!settings) {
      try {
        settings = await InvestmentSettings.create({
          id: 1, teaserHeadline: "Other Investments.", teaserBody: "Beyond our core operations...", sectionIntro: "We continuously look for opportunities...", is_locked: false,
        });
      } catch (err) {
        settings = await InvestmentSettings.findByPk(1);
      }
    }

    const categories = await AffiliateCategory.findAll({
      order: [["name", "ASC"]],
    });

    const companies = await Affiliate.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM ApprovalDrafts AS ad
              WHERE ad.target_id COLLATE utf8mb4_unicode_ci = CAST(Affiliate.id AS CHAR) COLLATE utf8mb4_unicode_ci
                AND ad.status COLLATE utf8mb4_unicode_ci = 'Rejected'
                AND ad.module_name COLLATE utf8mb4_unicode_ci = 'Affiliate'
            )`),
            "has_rejected_count",
          ],
        ],
      },
      order: [["id", "ASC"]],
    });

    const settingsDraft = await ApprovalDraft.count({
      where: { target_id: "1", module_name: "InvestmentSettings", status: "Rejected" },
    });

    const resultCompanies = companies.map((c) => {
      const data = c.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });

    const resultSettings = settings.get({ plain: true });
    resultSettings.has_rejected = settingsDraft > 0;

    return { settings: resultSettings, companies: resultCompanies, categories };
  }

  async getInvestmentData() {
    let settings = await InvestmentSettings.findOne();
    if (!settings) {
      settings = await InvestmentSettings.create({
        teaserHeadline: "Other Investments.", teaserBody: "Beyond our core operations...", sectionIntro: "We continuously look for opportunities...", is_locked: false,
      });
    }

    const companies = await Affiliate.findAll({
      order: [["id", "ASC"]],
      attributes: ["id", "name", "desc", "category", "category_id", "logoUrl", "websiteUrl", "is_locked", "lock_ticket"],
    });

    return { settings, companies };
  }

  // ==========================================
  // SETTINGS MUTATIONS
  // ==========================================

  async updateSettings({ userRole, body, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { status, previous_notrans } = body;
      let settings = await InvestmentSettings.findByPk(1, { transaction: t, lock: t.LOCK.UPDATE });
      if (!settings) settings = await InvestmentSettings.create({ id: 1 }, { transaction: t });

      if (settings.is_locked && userRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${settings.lock_ticket}`);
      }

      const { payload } = await this.processInvestmentPayload(body, settings);

      if (userRole === "editor" && status === "Published") {
        const notrans = await generateNotrans("INV_SET");

        if (previous_notrans) {
          await ApprovalDraft.update({ status: "Replaced" }, { where: { notrans: previous_notrans }, transaction: t });
        }

        await ApprovalDraft.create({
          notrans, module_name: "InvestmentSettings", action: "UPDATE", target_id: "1",
          payload: { ...payload, _translations: body._translations, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });

        await settings.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, karyawanId: actorId, token: owlToken, moduleName: "InvestmentSettings" });
        } catch (erpError) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts("InvestmentSettings", "1", t);
      await settings.update({ ...payload, is_locked: false, lock_ticket: null }, { transaction: t });
      // Flush old AI cache, then write manual overrides if provided
      await Translation.destroy({ where: { modelName: "InvestmentSettings", recordId: "1" }, transaction: t });
      if (body._translations) {
        await saveManualTranslations("InvestmentSettings", "1", body._translations, t);
      }
      await t.commit();
      
      return { success: true, isDraft: false, data: settings };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  // ==========================================
  // AFFILIATE MUTATIONS
  // ==========================================

  async createAffiliate({ userRole, body, file, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { status } = body;
      const { payload } = await this.processAffiliatePayload(body, file, {});
      const isEditor = userRole === "editor";
      
      const newCompany = await Affiliate.create({ ...payload, is_locked: isEditor }, { transaction: t });

      if (isEditor && status === "Published") {
        const notrans = await generateNotrans("AFF");
        await ApprovalDraft.create({
          notrans, module_name: "Affiliate", action: "CREATE", target_id: String(newCompany.id),
          payload: { ...payload, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });
        await newCompany.update({ lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: "Affiliate", karyawanId: actorId, token: owlToken });
        } catch (erpError) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await t.commit();
      return { success: true, isDraft: false, data: newCompany };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateAffiliate({ id, userRole, body, file, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { status, previous_notrans } = body;
      const company = await Affiliate.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!company) {
        await t.rollback();
        throw new Error("NOT_FOUND: Perusahaan afiliasi tidak ditemukan");
      }

      if (company.is_locked && userRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${company.lock_ticket}`);
      }

      const { payload, filesToDelete } = await this.processAffiliatePayload(body, file, company);
      const isDataChanged = payload.name !== company.name || payload.desc !== company.desc || payload.category_id !== company.category_id || payload.websiteUrl !== company.websiteUrl || filesToDelete.length > 0 || file;

      if (!isDataChanged && userRole === "editor") {
        await t.rollback();
        return { success: true, noChanges: true };
      }

      if (userRole === "editor" && status === "Published") {
        const notrans = await generateNotrans("AFF");
        if (previous_notrans) await ApprovalDraft.update({ status: "Replaced" }, { where: { notrans: previous_notrans }, transaction: t });

        await ApprovalDraft.create({
          notrans, module_name: "Affiliate", action: "UPDATE", target_id: String(id),
          payload: { ...payload, _translations: body._translations, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });

        await company.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: "Affiliate", karyawanId: actorId, token: owlToken });
        } catch (erpError) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts("Affiliate", String(id), t);
      await company.update({ ...payload, is_locked: false, lock_ticket: null }, { transaction: t });
      // Flush old AI cache, then write manual overrides if provided
      await Translation.destroy({ where: { modelName: "Affiliate", recordId: String(id) }, transaction: t });
      if (body._translations) {
        await saveManualTranslations("Affiliate", String(id), body._translations, t);
      }
      await t.commit();

      if (filesToDelete.length > 0) filesToDelete.forEach((f) => deleteSingleFile(f));

      return { success: true, isDraft: false, data: company };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteAffiliate({ id, userRole, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const company = await Affiliate.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!company) {
        await t.rollback();
        throw new Error("NOT_FOUND: Data tidak ditemukan");
      }

      if (company.is_locked && userRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${company.lock_ticket}`);
      }

      const logoToDelete = company.logoUrl;

      if (userRole === "editor") {
        const notrans = await generateNotrans("AFF_DEL");
        await ApprovalDraft.create({
          notrans, module_name: "Affiliate", action: "DELETE", target_id: String(id),
          payload: { ...company.get({ plain: true }), reason: "Request Delete" }, created_by: actorId, status: "Pending",
        }, { transaction: t });

        await company.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: "Affiliate", karyawanId: actorId, token: owlToken });
        } catch (erpError) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts("Affiliate", String(id), t);
      await company.destroy({ transaction: t });
      await Translation.destroy({ where: { modelName: "Affiliate", recordId: String(id) }, transaction: t });
      await t.commit();

      if (logoToDelete) deleteSingleFile(logoToDelete.replace("/uploads/", ""));

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new InvestmentService();
