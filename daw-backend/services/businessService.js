const sequelize = require("../config/database");
const BusinessSection = require("../models/BusinessSection");
const BusinessMapMarker = require("../models/BusinessMapMarker");
const Project = require("../models/Project");
const MapCategory = require("../models/MapCategory");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("./erpApprovalService");
const { autoTranslate } = require("./openaiService");
const { generateNotrans } = require("../utils/notransGenerator");
const { extractImagesFromHtml, handleEditorStaging } = require("../utils/editorHelper");
const { saveManualTranslations } = require("../utils/translationHelper");
const sanitizeHtml = require("sanitize-html");

const MODULE_NAME = "BusinessSection";
const MARKER_MODULE = "BusinessMapMarker";

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img", "h1", "h2", "h3", "h4", "h5", "h6", "table", "thead", "tbody", "tr", "th", "td", "iframe", "u", "s", "span", "br",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["style", "class"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen", "style", "class", "title"],
  },
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtu.be"],
  allowedSchemes: ["http", "https", "ftp", "mailto", "data"],
  allowedStyles: {
    "*": {
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
      "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      "background-color": [/^#(0x)?[0-9a-f]+$/i],
      "font-size": [/^\d+(px|em|rem|%)$/],
    },
  },
};

const slugify = (text) => {
  return text.toString().toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-").trim();
};

class BusinessService {
  /**
   * Helper: Normalize payload, execute sanitization, and calculate asset differences for orphaned file cleanup
   */
  async processBusinessPayload(body, existingData = {}) {
    const { title, category, htmlContent, hasMap, mapMarkers } = body;
    let filesToDelete = [];

    const cleanHtmlContent = htmlContent ? sanitizeHtml(htmlContent, sanitizeOptions) : existingData.htmlContent || "";

    if (existingData.htmlContent) {
      const oldImages = extractImagesFromHtml(existingData.htmlContent);
      const newImages = extractImagesFromHtml(cleanHtmlContent);

      const deletedImages = oldImages.filter((img) => !newImages.includes(img));
      filesToDelete = [...filesToDelete, ...deletedImages];
    }

    const isMapActive = [true, "true", 1, "1"].includes(hasMap) ? 1 : 0;
    const finalMarkers = Array.isArray(mapMarkers) ? mapMarkers.map((marker) => ({ ...marker, categoryId: marker.categoryId || marker.type })) : [];

    return {
      payload: {
        category: category || existingData.category,
        title: title || existingData.title,
        htmlContent: cleanHtmlContent,
        hasMap: isMapActive,
        mapMarkers: finalMarkers,
      },
      filesToDelete,
    };
  }

  // ─── ADMIN ENDPOINTS ───

  async getAdminBusinessSections() {
    const sections = await BusinessSection.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM ApprovalDrafts AS ad
              WHERE ad.target_id = BusinessSection.id
                AND ad.status = 'Rejected'
                AND ad.module_name = '${MODULE_NAME}'
            )`),
            "has_rejected_count",
          ],
        ],
      },
      include: [
        {
          model: BusinessMapMarker,
          as: "mapMarkers",
          required: false,
          include: [{ model: MapCategory, as: "categoryData", attributes: ["id", "name", "color"] }],
        },
      ],
      order: [["orderIndex", "ASC"]],
    });

    return sections.map((s) => {
      const data = s.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });
  }

  async getPublicBusinessData(lang = "en") {
    const rawSections = await BusinessSection.findAll({
      attributes: ["id", "category", "title", "htmlContent", "hasMap", "orderIndex", "is_locked", "lock_ticket"],
      include: [
        {
          model: BusinessMapMarker,
          as: "mapMarkers",
          required: false,
          include: [{ model: MapCategory, as: "categoryData", attributes: ["id", "name", "color"] }],
        },
      ],
      order: [["orderIndex", "ASC"]],
    });

    if (lang === "en") return rawSections;

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

    const translatedSections = [];
    for (let i = 0; i < rawSections.length; i++) {
      let sec = rawSections[i].get({ plain: true });

      sec.category = await safeTranslate(MODULE_NAME, sec.id, "category", sec.category);
      sec.title = await safeTranslate(MODULE_NAME, sec.id, "title", sec.title);
      sec.htmlContent = await safeTranslate(MODULE_NAME, sec.id, "htmlContent", sec.htmlContent);

      if (sec.mapMarkers && sec.mapMarkers.length > 0) {
        for (let j = 0; j < sec.mapMarkers.length; j++) {
          let marker = sec.mapMarkers[j];
          marker.title = await safeTranslate(MODULE_NAME, sec.id, `marker_${j}_title`, marker.title);
          marker.desc = await safeTranslate(MODULE_NAME, sec.id, `marker_${j}_desc`, marker.desc);
        }
      }

      translatedSections.push(sec);
    }
    return translatedSections;
  }

  async createBusinessSection({ req, res, body, userRole, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { category, title, status } = body;
      const normalizedRole = userRole?.toLowerCase();
      
      const timestampId = Date.now().toString(36);
      const generatedId = `${slugify(category).substring(0, 20)}-${timestampId}`;

      const existing = await BusinessSection.findByPk(generatedId, { transaction: t });
      if (existing) {
        await t.rollback();
        throw new Error("VALIDATION_ERROR: Sektor bisnis sudah ada!");
      }

      const maxOrder = (await BusinessSection.max("orderIndex", { transaction: t })) || 0;

      const sectionPayload = {
        id: generatedId,
        category,
        title,
        htmlContent: "",
        hasMap: false,
        orderIndex: maxOrder + 1,
        is_locked: false,
        lock_ticket: null,
      };

      if (normalizedRole === "editor" && status === "Published") {
        const notrans = await generateNotrans(MODULE_NAME);

        await BusinessSection.create({ ...sectionPayload, is_locked: true, lock_ticket: notrans }, { transaction: t });
        await ApprovalDraft.create(
          {
            notrans,
            module_name: MODULE_NAME,
            action: "CREATE",
            target_id: String(generatedId),
            payload: { category, title, status: "Published" },
            created_by: actorId,
            status: "Pending",
          },
          { transaction: t }
        );

        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({
            notrans,
            karyawanId: actorId,
            token: owlToken,
          });
        } catch (owlError) {
          console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
        }
        return { success: true, isDraft: true, ticket: notrans };
      }

      const newSection = await BusinessSection.create(sectionPayload, { transaction: t });
      await t.commit();
      
      return { success: true, isDraft: false, data: newSection };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateBusinessSection({ req, res, id, body, userRole, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase();
      const { status, previous_notrans, htmlContent } = body;

      const section = await BusinessSection.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!section) {
        await t.rollback();
        throw new Error("NOT_FOUND: Sektor Bisnis tidak ditemukan!");
      }

      if (htmlContent && htmlContent.includes("data:image/")) {
        await t.rollback();
        throw new Error("VALIDATION_ERROR: Format gambar tidak diizinkan. Gunakan fitur upload gambar di toolbar editor.");
      }

      if (section.is_locked && normalizedRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${section.lock_ticket}`);
      }

      const { payload, filesToDelete } = await this.processBusinessPayload(body, section);

      const originalHtml = (section.htmlContent || "").trim();
      const incomingHtml = (payload.htmlContent || "").trim();
      const isContentChanged = payload.title !== section.title || incomingHtml !== originalHtml || payload.category !== section.category;

      if (normalizedRole === "editor" && !isContentChanged) {
        // console.log(`>>> [HYBRID BYPASS] Editor ${actorId} memodifikasi peta tanpa mengubah teks. Direct Commit...`);
        await section.update({ hasMap: payload.hasMap }, { transaction: t });
        await BusinessMapMarker.destroy({ where: { sectionId: id }, transaction: t });
        
        if (payload.hasMap && payload.mapMarkers && payload.mapMarkers.length > 0) {
          const newMarkers = payload.mapMarkers.map((marker) => ({ ...marker, sectionId: id }));
          await BusinessMapMarker.bulkCreate(newMarkers, { transaction: t });
        }

        await t.commit();
        return { success: true, isHybridMapUpdate: true };
      }

      if (normalizedRole === "editor" && isContentChanged) {
        // console.log(`>>> [APPROVAL REQUIRED] Editor ${actorId} mengubah konten teks. Memulai draf...`);
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: MODULE_NAME,
          action: "UPDATE",
          targetId: id,
          payload: { ...payload, _translations: body._translations, status: "Published" },
          recordToLock: section,
          previousNotrans: previous_notrans,
          successMessage: "Revisi konten diajukan. Menunggu persetujuan.",
        });
      }

      if (normalizedRole === "superadmin" || normalizedRole === "admin") {
        await invalidateOldDrafts(MODULE_NAME, id, t);
      }
      
      await section.update({ title: payload.title, htmlContent: payload.htmlContent, hasMap: payload.hasMap, is_locked: false, lock_ticket: null }, { transaction: t });
      await BusinessMapMarker.destroy({ where: { sectionId: id }, transaction: t });
      
      if (payload.hasMap && payload.mapMarkers && payload.mapMarkers.length > 0) {
        const newMarkers = payload.mapMarkers.map((marker) => ({ ...marker, sectionId: id }));
        await BusinessMapMarker.bulkCreate(newMarkers, { transaction: t });
      }
      
      // Flush old AI cache, then write manual overrides if provided
      await Translation.destroy({ where: { modelName: MODULE_NAME, recordId: String(id) }, transaction: t });
      if (body._translations) {
        await saveManualTranslations(MODULE_NAME, id, body._translations, t);
      }
      await t.commit();
      
      if (filesToDelete && filesToDelete.length > 0) {
        filesToDelete.forEach((file) => deleteSingleFile(file));
      }
      
      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteSection({ req, res, id, userRole, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase();

      const section = await BusinessSection.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!section) {
        await t.rollback();
        throw new Error("NOT_FOUND: Sektor tidak ditemukan");
      }

      if (section.is_locked && normalizedRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${section.lock_ticket}`);
      }

      const attachedProjectsCount = await Project.count({ where: { category: id }, transaction: t });
      if (attachedProjectsCount > 0) {
        await t.rollback();
        throw new Error(`VALIDATION_ERROR: Hapus ditolak! Sektor ini masih memiliki ${attachedProjectsCount} proyek aktif. Pindahkan proyek terlebih dahulu.`);
      }

      let filesToDelete = [];
      if (section.htmlContent) {
        const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
        let match;
        while ((match = imgRegex.exec(section.htmlContent)) !== null) {
          filesToDelete.push(match[1]);
        }
      }

      if (normalizedRole === "editor") {
        const notrans = await generateNotrans(MODULE_NAME);
        await ApprovalDraft.create(
          {
            notrans,
            module_name: MODULE_NAME,
            action: "DELETE",
            target_id: String(id),
            payload: { title: section.title, reason: "Request Delete" },
            created_by: actorId,
            status: "Pending",
          },
          { transaction: t }
        );

        await section.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({
            notrans,
            karyawanId: actorId,
            token: owlToken,
          });
        } catch (owlError) {
          console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
        }
        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts(MODULE_NAME, id, t);
      await BusinessMapMarker.destroy({ where: { sectionId: id }, transaction: t });
      await section.destroy({ transaction: t });
      await Translation.destroy({ where: { modelName: MODULE_NAME, recordId: String(id) }, transaction: t });
      await t.commit();

      if (filesToDelete.length > 0) filesToDelete.forEach((file) => deleteSingleFile(file));

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new BusinessService();
