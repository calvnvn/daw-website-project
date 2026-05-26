const sequelize = require("../config/database");
const InvestmentSettings = require("../models/InvestmentSettings");
const Affiliate = require("../models/Affiliate");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { deleteSingleFile } = require("../utils/fileRemover");
const { generateNotrans } = require("../utils/notransGenerator");
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
    const { name, desc, category, websiteUrl, removePhoto } = body;
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
        category: category || existingData.category,
        websiteUrl: websiteUrl !== undefined ? websiteUrl : existingData.websiteUrl,
        logoUrl: finalLogoUrl,
      },
      filesToDelete,
    };
  }

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

    const companies = await Affiliate.findAll({
      order: [["id", "ASC"]],
      attributes: ["id", "name", "desc", "category", "logoUrl", "websiteUrl", "is_locked"],
    });

    const createDrafts = await ApprovalDraft.findAll({
      where: { module_name: "Affiliate", action: "CREATE", status: "Pending" },
    });
    const newDraftIds = createDrafts.map((d) => String(d.target_id));

    const filteredCompanies = companies.filter((c) => !newDraftIds.includes(String(c.id)));

    if (lang === "en") return { settings, companies: filteredCompanies };

    let plainSettings = settings.get({ plain: true });
    const SETTINGS_MODULE = "InvestmentSettings";

    let headlineTrans = await Translation.findOne({ where: { modelName: SETTINGS_MODULE, recordId: "1", field: "teaserHeadline", locale: "id" } });
    let bodyTrans = await Translation.findOne({ where: { modelName: SETTINGS_MODULE, recordId: "1", field: "teaserBody", locale: "id" } });
    let introTrans = await Translation.findOne({ where: { modelName: SETTINGS_MODULE, recordId: "1", field: "sectionIntro", locale: "id" } });

    if ((plainSettings.teaserHeadline && !headlineTrans) || (plainSettings.teaserBody && !bodyTrans) || (plainSettings.sectionIntro && !introTrans)) {
      const freshHeadline = plainSettings.teaserHeadline && !headlineTrans ? await autoTranslate(plainSettings.teaserHeadline, "Indonesian") : "";
      const freshBody = plainSettings.teaserBody && !bodyTrans ? await autoTranslate(plainSettings.teaserBody, "Indonesian") : "";
      const freshIntro = plainSettings.sectionIntro && !introTrans ? await autoTranslate(plainSettings.sectionIntro, "Indonesian") : "";

      const upsertSettingsTrans = async (field, translatedText) => {
        if (!translatedText) return;
        const existing = await Translation.findOne({ where: { modelName: SETTINGS_MODULE, recordId: "1", field, locale: "id" } });
        if (existing) await existing.update({ translatedText });
        else await Translation.create({ modelName: SETTINGS_MODULE, recordId: "1", field, locale: "id", translatedText });
      };

      if (freshHeadline) { await upsertSettingsTrans("teaserHeadline", freshHeadline); plainSettings.teaserHeadline = freshHeadline; }
      if (freshBody) { await upsertSettingsTrans("teaserBody", freshBody); plainSettings.teaserBody = freshBody; }
      if (freshIntro) { await upsertSettingsTrans("sectionIntro", freshIntro); plainSettings.sectionIntro = freshIntro; }
    } else {
      if (headlineTrans) plainSettings.teaserHeadline = headlineTrans.translatedText;
      if (bodyTrans) plainSettings.teaserBody = bodyTrans.translatedText;
      if (introTrans) plainSettings.sectionIntro = introTrans.translatedText;
    }

    const AFFILIATE_MODULE = "Affiliate";
    const translatedCompanies = [];

    for (let i = 0; i < filteredCompanies.length; i++) {
      let company = filteredCompanies[i].get({ plain: true });
      let descTrans = await Translation.findOne({ where: { modelName: AFFILIATE_MODULE, recordId: String(company.id), field: "desc", locale: "id" } });

      if (company.desc && !descTrans) {
        const freshDesc = await autoTranslate(company.desc, "Indonesian");
        const upsertAffiliateTrans = async (field, translatedText) => {
          if (!translatedText) return;
          const existing = await Translation.findOne({ where: { modelName: AFFILIATE_MODULE, recordId: String(company.id), field, locale: "id" } });
          if (existing) await existing.update({ translatedText });
          else await Translation.create({ modelName: AFFILIATE_MODULE, recordId: String(company.id), field, locale: "id", translatedText });
        };
        if (freshDesc) { await upsertAffiliateTrans("desc", freshDesc); company.desc = freshDesc; }
      } else {
        if (descTrans) company.desc = descTrans.translatedText;
      }
      translatedCompanies.push(company);
    }

    return { settings: plainSettings, companies: translatedCompanies };
  }

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

    return { settings: resultSettings, companies: resultCompanies };
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
      attributes: ["id", "name", "desc", "category", "logoUrl", "websiteUrl", "is_locked", "lock_ticket"],
    });

    return { settings, companies };
  }

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
          payload: { ...payload, status: "Published" }, created_by: actorId, status: "Pending",
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
      await t.commit();
      
      return { success: true, isDraft: false, data: settings };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

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
      const isDataChanged = payload.name !== company.name || payload.desc !== company.desc || payload.category !== company.category || payload.websiteUrl !== company.websiteUrl || filesToDelete.length > 0 || file;

      if (!isDataChanged && userRole === "editor") {
        await t.rollback();
        return { success: true, noChanges: true };
      }

      if (userRole === "editor" && status === "Published") {
        const notrans = await generateNotrans("AFF");
        if (previous_notrans) await ApprovalDraft.update({ status: "Replaced" }, { where: { notrans: previous_notrans }, transaction: t });

        await ApprovalDraft.create({
          notrans, module_name: "Affiliate", action: "UPDATE", target_id: String(id),
          payload: { ...payload, status: "Published" }, created_by: actorId, status: "Pending",
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
