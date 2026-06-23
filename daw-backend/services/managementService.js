const { Op } = require("sequelize");
const sequelize = require("../config/database");
const Management = require("../models/Management");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("./erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");
const { autoTranslate } = require("./openaiService");
const { saveManualTranslations } = require("../utils/translationHelper");
const { handleEditorStaging } = require("../utils/editorHelper");

const MODULE_NAME = "Management";
const NOTRANS_PREFIX = "MGT";

class ManagementService {
  async processManagementPayload(body, file, existingData = {}) {
    const { name, role, description, level, order, removePhoto } = body;
    let filesToDelete = [];

    let finalPhotoUrl = existingData.photoUrl || null;
    if (file) {
      if (existingData.photoUrl) filesToDelete.push(existingData.photoUrl);
      finalPhotoUrl = file.filename;
    } else if (removePhoto === "true" || removePhoto === true) {
      if (existingData.photoUrl) filesToDelete.push(existingData.photoUrl);
      finalPhotoUrl = null;
    }

    const finalLevel = level || existingData.level || "division";
    const finalOrder = order ? parseInt(order, 10) : existingData.order || 1;

    return {
      payload: {
        name: (name || existingData.name || "").trim(),
        role: (role || existingData.role || "").trim(),
        description: description !== undefined ? description.trim() : existingData.description || "",
        level: finalLevel,
        order: finalOrder,
        photoUrl: finalPhotoUrl,
      },
      filesToDelete,
    };
  }

  async getAllManagements(lang = "en") {
    const managements = await Management.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) > 0 
              FROM ApprovalDrafts 
              WHERE ApprovalDrafts.target_id = Management.id COLLATE utf8mb4_unicode_ci 
              AND ApprovalDrafts.module_name = '${MODULE_NAME}' 
              AND ApprovalDrafts.status = 'Rejected'
            )`),
            "hasRejected",
          ],
        ],
      },
      order: [
        ["level", "ASC"],
        ["order", "ASC"],
      ],
    });

    const formattedData = managements.map((m) => {
      const item = m.toJSON();
      item.hasRejected = !!item.hasRejected;
      return item;
    });

    // Filter out draft-created records (Pending or Rejected CREATE drafts should never appear publicly)
    const createDrafts = await ApprovalDraft.findAll({
      where: { module_name: MODULE_NAME, action: "CREATE", status: { [Op.in]: ["Pending", "Rejected"] } },
    });
    const draftIds = new Set(createDrafts.map((d) => String(d.target_id)));
    const publicData = formattedData.filter((item) => !draftIds.has(String(item.id)));

    if (lang === "en") return publicData;

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

    const translatedManagements = [];
    for (let i = 0; i < publicData.length; i++) {
      let item = publicData[i];
      item.role = await safeTranslate(MODULE_NAME, item.id, "role", item.role);
      item.description = await safeTranslate(MODULE_NAME, item.id, "description", item.description);
      translatedManagements.push(item);
    }

    return translatedManagements;
  }

  async createManagement({ req, res, userRole, body, file, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { status } = body;
      const { payload } = await this.processManagementPayload(body, file, {});
      const isEditor = userRole === "editor" && status === "Published";

      const newRecord = await Management.create(
        { ...payload, is_locked: isEditor, lock_ticket: null },
        { transaction: t }
      );

      if (isEditor) {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: NOTRANS_PREFIX,
          action: "CREATE",
          targetId: String(newRecord.id),
          payload: { ...payload, status: "Published", _translations: body._translations },
          recordToLock: newRecord,
          successMessage: "Data manajemen baru diajukan ke ERP OWL.",
        });
      }

      await saveManualTranslations(MODULE_NAME, newRecord.id, body._translations, t);
      await t.commit();
      return { success: true, isDraft: false, data: newRecord };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      if (file && file.filename) deleteSingleFile(file.filename);
      throw error;
    }
  }

  async updateManagement({ req, res, id, userRole, body, file, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { status, previous_notrans } = body;
      const person = await Management.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!person) {
        await t.rollback();
        throw new Error("NOT_FOUND: Data tidak ditemukan.");
      }

      if (person.is_locked && userRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${person.lock_ticket}`);
      }

      const { payload, filesToDelete } = await this.processManagementPayload(body, file, person);
      const isEditor = userRole === "editor" && status === "Published";

      if (isEditor) {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: NOTRANS_PREFIX,
          action: "UPDATE",
          targetId: String(id),
          payload: { ...payload, status: "Published", _translations: body._translations },
          recordToLock: person,
          previousNotrans: previous_notrans,
          successMessage: "Revisi data manajemen diajukan ke ERP OWL.",
        });
      }

      await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, target_id: String(id), status: ["Pending", "Rejected"] }, transaction: t });
      await person.update({ ...payload, is_locked: false, lock_ticket: null }, { transaction: t });
      await saveManualTranslations(MODULE_NAME, id, body._translations, t);
      await t.commit();

      if (filesToDelete.length > 0) filesToDelete.forEach((f) => deleteSingleFile(f));
      
      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      if (file && file.filename) deleteSingleFile(file.filename);
      throw error;
    }
  }

  async deleteManagement({ req, res, id, userRole, actorId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const person = await Management.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!person) {
        await t.rollback();
        throw new Error("NOT_FOUND: Data tidak ditemukan.");
      }

      if (person.is_locked && userRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${person.lock_ticket}`);
      }

      const photoToDelete = person.photoUrl;

      if (userRole === "editor") {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: NOTRANS_PREFIX,
          action: "DELETE",
          targetId: String(id),
          payload: { name: person.name, role: person.role, photoUrl: person.photoUrl },
          recordToLock: person,
          successMessage: "Permintaan hapus data manajemen diajukan ke ERP OWL.",
        });
      }

      await invalidateOldDrafts(MODULE_NAME, id, t);
      await person.destroy({ transaction: t });
      await Translation.destroy({ where: { modelName: MODULE_NAME, recordId: String(id) }, transaction: t });
      await t.commit();
      
      if (photoToDelete) deleteSingleFile(photoToDelete);

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new ManagementService();
