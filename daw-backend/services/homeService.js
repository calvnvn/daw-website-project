const fs = require("fs");
const path = require("path");
const sequelize = require("../config/database");
const { Op } = require("sequelize");

const HeroSlides = require("../models/HeroSlides");
const HomeSettings = require("../models/HomeSettings");
const ImpactStats = require("../models/ImpactStats");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");

const { deleteSingleFile } = require("../utils/fileRemover");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");
const ErpApprovalService = require("./erpApprovalService");
const { autoTranslate } = require("./openaiService");

const MODULE_NAME = "HomeSettings";
const NOTRANS_PREFIX = "HOME";

class HomeService {
  applyTempPrefix(fileObj) {
    if (!fileObj || !fileObj.filename) return null;
    const filename = fileObj.filename;
    if (filename.startsWith("TEMP_")) return filename;

    const uploadDir = path.join(__dirname, "..", "public", "uploads");
    const oldPath = fileObj.path || path.join(uploadDir, filename);
    const newFilename = `TEMP_${filename}`;
    const newPath = path.join(uploadDir, newFilename);

    try {
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        return newFilename;
      }
      return filename;
    } catch (err) {
      console.error(`🚨 [TEMP GUARD ERROR]: ${err.message}`);
      return filename;
    }
  }

  // ─── SETTINGS ───

  async getPublicHomepageData(lang = "en") {
    const results = await Promise.allSettled([
      HeroSlides.findAll({ order: [["order", "ASC"]] }),
      ImpactStats.findAll({ order: [["order", "ASC"]] }),
      HomeSettings.findByPk(1),
    ]);

    const slides = results[0].status === "fulfilled" ? results[0].value : [];
    const stats = results[1].status === "fulfilled" ? results[1].value : [];
    let settings = results[2].status === "fulfilled" ? results[2].value : null;

    if (!settings && results[2].status === "fulfilled") {
      settings = await HomeSettings.create({
        id: 1,
        introHeadline: "A Transformation Company.",
        introBody: "Welcome to DAW.",
      });
    }

    let finalSlides = slides;
    let finalStats = stats;
    let finalSettings = settings;

    if (lang !== "en") {
      finalSlides = [];
      for (let i = 0; i < slides.length; i++) {
        const item = slides[i].get ? slides[i].get({ plain: true }) : { ...slides[i] };
        let titleTrans = await Translation.findOne({ where: { modelName: "HeroSlides", recordId: String(item.id), field: "title", locale: "id" } });
        let subtitleTrans = await Translation.findOne({ where: { modelName: "HeroSlides", recordId: String(item.id), field: "subtitle", locale: "id" } });
        
        if ((item.title && !titleTrans) || (item.subtitle && !subtitleTrans)) {
          const freshTitle = item.title && !titleTrans ? await autoTranslate(item.title, "Indonesian") : "";
          const freshSubtitle = item.subtitle && !subtitleTrans ? await autoTranslate(item.subtitle, "Indonesian") : "";
          
          const upsertTrans = async (field, translatedText) => {
            if (!translatedText) return;
            const existing = await Translation.findOne({ where: { modelName: "HeroSlides", recordId: String(item.id), field, locale: "id" } });
            if (existing) await existing.update({ translatedText });
            else await Translation.create({ modelName: "HeroSlides", recordId: String(item.id), field, locale: "id", translatedText });
          };
          
          if (freshTitle) { await upsertTrans("title", freshTitle); item.title = freshTitle; }
          if (freshSubtitle) { await upsertTrans("subtitle", freshSubtitle); item.subtitle = freshSubtitle; }
        } else {
          if (titleTrans) item.title = titleTrans.translatedText;
          if (subtitleTrans) item.subtitle = subtitleTrans.translatedText;
        }
        finalSlides.push(item);
      }

      finalStats = [];
      for (let i = 0; i < stats.length; i++) {
        const item = stats[i].get ? stats[i].get({ plain: true }) : { ...stats[i] };
        let labelTrans = await Translation.findOne({ where: { modelName: "ImpactStats", recordId: String(item.id), field: "label", locale: "id" } });
        let descTrans = await Translation.findOne({ where: { modelName: "ImpactStats", recordId: String(item.id), field: "desc", locale: "id" } });
        
        if ((item.label && !labelTrans) || (item.desc && !descTrans)) {
          const freshLabel = item.label && !labelTrans ? await autoTranslate(item.label, "Indonesian") : "";
          const freshDesc = item.desc && !descTrans ? await autoTranslate(item.desc, "Indonesian") : "";
          
          const upsertTrans = async (field, translatedText) => {
            if (!translatedText) return;
            const existing = await Translation.findOne({ where: { modelName: "ImpactStats", recordId: String(item.id), field, locale: "id" } });
            if (existing) await existing.update({ translatedText });
            else await Translation.create({ modelName: "ImpactStats", recordId: String(item.id), field, locale: "id", translatedText });
          };
          
          if (freshLabel) { await upsertTrans("label", freshLabel); item.label = freshLabel; }
          if (freshDesc) { await upsertTrans("desc", freshDesc); item.desc = freshDesc; }
        } else {
          if (labelTrans) item.label = labelTrans.translatedText;
          if (descTrans) item.desc = descTrans.translatedText;
        }
        finalStats.push(item);
      }

      if (settings) {
        const item = settings.get ? settings.get({ plain: true }) : { ...settings };
        let headlineTrans = await Translation.findOne({ where: { modelName: "HomeSettings", recordId: "1", field: "introHeadline", locale: "id" } });
        let bodyTrans = await Translation.findOne({ where: { modelName: "HomeSettings", recordId: "1", field: "introBody", locale: "id" } });
        
        if ((item.introHeadline && !headlineTrans) || (item.introBody && !bodyTrans)) {
          const freshHeadline = item.introHeadline && !headlineTrans ? await autoTranslate(item.introHeadline, "Indonesian") : "";
          const freshBody = item.introBody && !bodyTrans ? await autoTranslate(item.introBody, "Indonesian") : "";
          
          const upsertTrans = async (field, translatedText) => {
            if (!translatedText) return;
            const existing = await Translation.findOne({ where: { modelName: "HomeSettings", recordId: "1", field, locale: "id" } });
            if (existing) await existing.update({ translatedText });
            else await Translation.create({ modelName: "HomeSettings", recordId: "1", field, locale: "id", translatedText });
          };
          
          if (freshHeadline) { await upsertTrans("introHeadline", freshHeadline); item.introHeadline = freshHeadline; }
          if (freshBody) { await upsertTrans("introBody", freshBody); item.introBody = freshBody; }
        } else {
          if (headlineTrans) item.introHeadline = headlineTrans.translatedText;
          if (bodyTrans) item.introBody = bodyTrans.translatedText;
        }
        finalSettings = item;
      }
    }

    return { slides: finalSlides, stats: finalStats, settings: finalSettings };
  }

  async getAdminHomepageData(actorId, lang = "en") {
    const lockAttributes = ["is_locked", "lock_ticket"];
    
    const results = await Promise.allSettled([
      HeroSlides.findAll({ order: [["order", "ASC"]], attributes: { include: lockAttributes } }),
      ImpactStats.findAll({ order: [["order", "ASC"]], attributes: { include: lockAttributes } }),
      HomeSettings.findByPk(1, { attributes: { include: lockAttributes } }),
      ApprovalDraft.findAll({
        where: {
          module_name: ["HeroSlides", "HeroSlide", "ImpactStats", "HomeSettings"],
          status: "Rejected",
          [Op.and]: [sequelize.where(sequelize.fn("LOWER", sequelize.col("created_by")), actorId)],
        },
      }),
    ]);

    const slides = results[0].status === "fulfilled" ? results[0].value : [];
    const stats = results[1].status === "fulfilled" ? results[1].value : [];
    let settings = results[2].status === "fulfilled" ? results[2].value : null;
    const rejections = results[3].status === "fulfilled" ? results[3].value : [];

    if (!settings && results[2].status === "fulfilled") {
      settings = await HomeSettings.create({
        id: 1, introHeadline: "A Transformation Company.", introBody: "Welcome to DAW.",
      });
    }

    let finalSlides = slides;
    let finalStats = stats;
    let finalSettings = settings;

    if (lang !== "en") {
      finalSlides = [];
      for (let i = 0; i < slides.length; i++) {
        const item = slides[i].get ? slides[i].get({ plain: true }) : { ...slides[i] };
        let titleTrans = await Translation.findOne({ where: { modelName: "HeroSlides", recordId: String(item.id), field: "title", locale: "id" } });
        let subtitleTrans = await Translation.findOne({ where: { modelName: "HeroSlides", recordId: String(item.id), field: "subtitle", locale: "id" } });
        
        if ((item.title && !titleTrans) || (item.subtitle && !subtitleTrans)) {
          const freshTitle = item.title && !titleTrans ? await autoTranslate(item.title, "Indonesian") : "";
          const freshSubtitle = item.subtitle && !subtitleTrans ? await autoTranslate(item.subtitle, "Indonesian") : "";
          
          const upsertTrans = async (field, translatedText) => {
            if (!translatedText) return;
            const existing = await Translation.findOne({ where: { modelName: "HeroSlides", recordId: String(item.id), field, locale: "id" } });
            if (existing) await existing.update({ translatedText });
            else await Translation.create({ modelName: "HeroSlides", recordId: String(item.id), field, locale: "id", translatedText });
          };
          
          if (freshTitle) { await upsertTrans("title", freshTitle); item.title = freshTitle; }
          if (freshSubtitle) { await upsertTrans("subtitle", freshSubtitle); item.subtitle = freshSubtitle; }
        } else {
          if (titleTrans) item.title = titleTrans.translatedText;
          if (subtitleTrans) item.subtitle = subtitleTrans.translatedText;
        }
        finalSlides.push(item);
      }

      finalStats = [];
      for (let i = 0; i < stats.length; i++) {
        const item = stats[i].get ? stats[i].get({ plain: true }) : { ...stats[i] };
        let labelTrans = await Translation.findOne({ where: { modelName: "ImpactStats", recordId: String(item.id), field: "label", locale: "id" } });
        let descTrans = await Translation.findOne({ where: { modelName: "ImpactStats", recordId: String(item.id), field: "desc", locale: "id" } });
        
        if ((item.label && !labelTrans) || (item.desc && !descTrans)) {
          const freshLabel = item.label && !labelTrans ? await autoTranslate(item.label, "Indonesian") : "";
          const freshDesc = item.desc && !descTrans ? await autoTranslate(item.desc, "Indonesian") : "";
          
          const upsertTrans = async (field, translatedText) => {
            if (!translatedText) return;
            const existing = await Translation.findOne({ where: { modelName: "ImpactStats", recordId: String(item.id), field, locale: "id" } });
            if (existing) await existing.update({ translatedText });
            else await Translation.create({ modelName: "ImpactStats", recordId: String(item.id), field, locale: "id", translatedText });
          };
          
          if (freshLabel) { await upsertTrans("label", freshLabel); item.label = freshLabel; }
          if (freshDesc) { await upsertTrans("desc", freshDesc); item.desc = freshDesc; }
        } else {
          if (labelTrans) item.label = labelTrans.translatedText;
          if (descTrans) item.desc = descTrans.translatedText;
        }
        finalStats.push(item);
      }

      if (settings) {
        const item = settings.get ? settings.get({ plain: true }) : { ...settings };
        let headlineTrans = await Translation.findOne({ where: { modelName: "HomeSettings", recordId: "1", field: "introHeadline", locale: "id" } });
        let bodyTrans = await Translation.findOne({ where: { modelName: "HomeSettings", recordId: "1", field: "introBody", locale: "id" } });
        
        if ((item.introHeadline && !headlineTrans) || (item.introBody && !bodyTrans)) {
          const freshHeadline = item.introHeadline && !headlineTrans ? await autoTranslate(item.introHeadline, "Indonesian") : "";
          const freshBody = item.introBody && !bodyTrans ? await autoTranslate(item.introBody, "Indonesian") : "";
          
          const upsertTrans = async (field, translatedText) => {
            if (!translatedText) return;
            const existing = await Translation.findOne({ where: { modelName: "HomeSettings", recordId: "1", field, locale: "id" } });
            if (existing) await existing.update({ translatedText });
            else await Translation.create({ modelName: "HomeSettings", recordId: "1", field, locale: "id", translatedText });
          };
          
          if (freshHeadline) { await upsertTrans("introHeadline", freshHeadline); item.introHeadline = freshHeadline; }
          if (freshBody) { await upsertTrans("introBody", freshBody); item.introBody = freshBody; }
        } else {
          if (headlineTrans) item.introHeadline = headlineTrans.translatedText;
          if (bodyTrans) item.introBody = bodyTrans.translatedText;
        }
        finalSettings = item;
      }
    }

    return { slides: finalSlides, stats: finalStats, settings: finalSettings, rejectionRadar: rejections };
  }

  async updateSettings({ userRole, body, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { introHeadline, introBody, status, previous_notrans } = body;
      const safeHeadline = (introHeadline || "").trim();
      const safeBody = (introBody || "").trim();

      let settings = await HomeSettings.findByPk(1, { transaction: t, lock: t.LOCK.UPDATE });
      if (!settings) settings = await HomeSettings.create({ id: 1 }, { transaction: t });

      if (userRole === "editor") {
        if (settings.is_locked) {
          await t.rollback();
          throw new Error(`LOCKED: tiket ${settings.lock_ticket}`);
        }

        const notrans = await generateNotrans(NOTRANS_PREFIX);
        const ticketToClear = previous_notrans || settings.lock_ticket;
        if (ticketToClear) {
          await ApprovalDraft.update({ status: "Replaced" }, { where: { notrans: ticketToClear, module_name: MODULE_NAME }, transaction: t });
        }

        await ApprovalDraft.create({
          notrans, module_name: MODULE_NAME, action: "UPDATE", target_id: "1",
          payload: { introHeadline: safeHeadline, introBody: safeBody, status: "Published" },
          created_by: actorId, status: "Pending",
        }, { transaction: t });

        await settings.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: MODULE_NAME, karyawanId: actorId, token: owlToken });
        } catch (owlError) {
          console.error(`🚨 [ERP SYNC FAILED]: ${owlError.message}`);
        }
        return { success: true, isDraft: true, ticket: notrans };
      }

      await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, status: ["Pending", "Rejected"] }, transaction: t });
      await settings.update({ introHeadline: safeHeadline, introBody: safeBody, is_locked: false, lock_ticket: null }, { transaction: t });
      await t.commit();
      
      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  // ─── HERO SLIDES ───

  async createHeroSlide({ userRole, body, file, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { title, subtitle, order, status } = body;
      const slideData = { title, subtitle, order, imageUrl: null, is_locked: false };

      if (file) slideData.imageUrl = userRole === "editor" ? this.applyTempPrefix(file) : file.filename;

      if (userRole === "editor" && status === "Published") {
        const notrans = await generateNotrans("HERO");
        await ApprovalDraft.create({
          notrans, module_name: "HeroSlides", action: "CREATE", target_id: "0",
          payload: { ...slideData, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });
        slideData.is_locked = true;
        slideData.lock_ticket = notrans;
      }

      const newSlide = await HeroSlides.create(slideData, { transaction: t });
      if (userRole === "editor" && status === "Published") {
        await ApprovalDraft.update({ target_id: String(newSlide.id) }, { where: { notrans: slideData.lock_ticket }, transaction: t });
        await t.commit();
        try {
          await ErpApprovalService.initiateApproval({ notrans: slideData.lock_ticket, moduleName: "HeroSlides", karyawanId: actorId, token: owlToken });
        } catch (erpErr) { console.error("⚠️ [ERP_SYNC_WARNING]:", erpErr.message); }
        return { success: true, isDraft: true, ticket: slideData.lock_ticket };
      }

      await t.commit();
      return { success: true, isDraft: false, data: newSlide };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateHeroSlide({ id, userRole, body, file, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { title, subtitle, order, status, previous_notrans } = body;

      const slide = await HeroSlides.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!slide) {
        await t.rollback();
        throw new Error("NOT_FOUND: Slide not found");
      }

      if (userRole === "editor" && slide.is_locked) {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${slide.lock_ticket}`);
      }

      let newImageUrl = slide.imageUrl;
      let oldImageToDelete = null;

      if (file) {
        oldImageToDelete = slide.imageUrl;
        newImageUrl = userRole === "editor" ? this.applyTempPrefix(file) : file.filename;
      }

      const updatedData = { title, subtitle, order, imageUrl: newImageUrl };

      if (userRole === "editor" && status === "Published") {
        const notrans = await generateNotrans("HERO");
        if (previous_notrans) await ApprovalDraft.update({ status: "Replaced" }, { where: { notrans: previous_notrans }, transaction: t });
        await ApprovalDraft.create({
          notrans, module_name: "HeroSlides", action: "UPDATE", target_id: String(id),
          payload: { ...updatedData, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });
        await slide.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: "HeroSlides", karyawanId: actorId, token: owlToken });
        } catch (owlError) {}
        
        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts(id, "HeroSlides", t);
      await slide.update({ ...updatedData, is_locked: false, lock_ticket: null }, { transaction: t });
      await t.commit();
      if (oldImageToDelete) deleteSingleFile(oldImageToDelete);

      return { success: true, isDraft: false, data: slide };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteHeroSlide({ id, userRole, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const slide = await HeroSlides.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!slide) {
        await t.rollback();
        throw new Error("NOT_FOUND: Slide not found");
      }

      if (userRole === "editor" && slide.is_locked) {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${slide.lock_ticket}`);
      }

      if (userRole === "editor") {
        const notrans = await generateNotrans("HERO_DEL");
        await ApprovalDraft.create({
          notrans, module_name: "HeroSlides", action: "DELETE", target_id: String(id),
          payload: { ...slide.get({ plain: true }), reason: "Request Delete" },
          created_by: actorId, status: "Pending",
        }, { transaction: t });
        await slide.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: "HeroSlides", karyawanId: actorId, token: owlToken });
        } catch (owlError) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts(id, "HeroSlides", t);
      const imageToDelete = slide.imageUrl;
      await slide.destroy({ transaction: t });
      await t.commit();
      if (imageToDelete) deleteSingleFile(imageToDelete);

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  // ─── IMPACT STATS ───

  async createStat({ userRole, body, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { icon, value, label, desc, order, status } = body;

      const count = await ImpactStats.count({ transaction: t });
      if (count >= 4) {
        await t.rollback();
        throw new Error("VALIDATION_ERROR: Maksimal hanya 4 statistik! Hapus statistik lama jika ingin menambah baru.");
      }

      const statData = { icon: icon || "Map", value, label, desc, order, is_locked: false };

      if (userRole === "editor" && status === "Published") {
        const notrans = await generateNotrans("STAT");
        await ApprovalDraft.create({
          notrans, module_name: "ImpactStats", action: "CREATE", target_id: "0",
          payload: { ...statData, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });
        statData.is_locked = true;
        statData.lock_ticket = notrans;
      }

      const newStat = await ImpactStats.create(statData, { transaction: t });

      if (userRole === "editor" && status === "Published") {
        await ApprovalDraft.update({ target_id: String(newStat.id) }, { where: { notrans: statData.lock_ticket }, transaction: t });
        await t.commit();
        try {
          await ErpApprovalService.initiateApproval({ notrans: statData.lock_ticket, moduleName: "ImpactStats", karyawanId: actorId, token: owlToken });
        } catch (erpErr) {}
        return { success: true, isDraft: true, ticket: statData.lock_ticket };
      }

      await t.commit();
      return { success: true, isDraft: false, data: newStat };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateStat({ id, userRole, body, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { icon, value, label, desc, order, status, previous_notrans } = body;

      const stat = await ImpactStats.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!stat) {
        await t.rollback();
        throw new Error("NOT_FOUND: Stat not found");
      }

      if (userRole === "editor" && stat.is_locked) {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${stat.lock_ticket}`);
      }

      const updatedData = { icon, value, label, desc, order };

      if (userRole === "editor" && status === "Published") {
        const notrans = await generateNotrans("STAT");
        if (previous_notrans) await ApprovalDraft.update({ status: "Replaced" }, { where: { notrans: previous_notrans }, transaction: t });
        await ApprovalDraft.create({
          notrans, module_name: "ImpactStats", action: "UPDATE", target_id: String(id),
          payload: { ...updatedData, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });
        await stat.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: "ImpactStats", karyawanId: actorId, token: owlToken });
        } catch (erpErr) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts("ImpactStats", String(id), t);
      await stat.update({ ...updatedData, is_locked: false, lock_ticket: null }, { transaction: t });
      await t.commit();

      return { success: true, isDraft: false, data: stat };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteStat({ id, userRole, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const stat = await ImpactStats.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!stat) {
        await t.rollback();
        throw new Error("NOT_FOUND: Stat not found");
      }

      if (userRole === "editor" && stat.is_locked) {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${stat.lock_ticket}`);
      }

      if (userRole === "editor") {
        const notrans = await generateNotrans("STAT_DEL");
        await ApprovalDraft.create({
          notrans, module_name: "ImpactStats", action: "DELETE", target_id: String(id),
          payload: { ...stat.get({ plain: true }), reason: "Request Delete" },
          created_by: actorId, status: "Pending",
        }, { transaction: t });
        await stat.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: "ImpactStats", karyawanId: actorId, token: owlToken });
        } catch (erpError) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts(id, "ImpactStats", t);
      await stat.destroy({ transaction: t });
      await t.commit();
      
      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new HomeService();
