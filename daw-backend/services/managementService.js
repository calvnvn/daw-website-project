const sequelize = require("../config/database");
const Management = require("../models/Management");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("./erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");
const { autoTranslate } = require("./openaiService");

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

    if (lang === "en") return formattedData;

    const translatedManagements = [];
    for (let i = 0; i < formattedData.length; i++) {
      let item = formattedData[i];
      
      let roleTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field: "role", locale: "id" } });
      let descTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field: "description", locale: "id" } });
      
      if ((item.role && !roleTrans) || (item.description && !descTrans)) {
        const freshRole = item.role && !roleTrans ? await autoTranslate(item.role, "Indonesian") : "";
        const freshDesc = item.description && !descTrans ? await autoTranslate(item.description, "Indonesian") : "";
        
        const upsertMgtTrans = async (field, translatedText) => {
          if (!translatedText) return;
          const existing = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field, locale: "id" } });
          if (existing) await existing.update({ translatedText });
          else await Translation.create({ modelName: MODULE_NAME, recordId: String(item.id), field, locale: "id", translatedText });
        };

        if (freshRole) { await upsertMgtTrans("role", freshRole); item.role = freshRole; }
        if (freshDesc) { await upsertMgtTrans("description", freshDesc); item.description = freshDesc; }
      } else {
        if (roleTrans) item.role = roleTrans.translatedText;
        if (descTrans) item.description = descTrans.translatedText;
      }
      translatedManagements.push(item);
    }

    return translatedManagements;
  }

  async createManagement({ userRole, body, file, actorId, owlToken }) {
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
        const notrans = await generateNotrans(NOTRANS_PREFIX);
        await ApprovalDraft.create({
          notrans, module_name: MODULE_NAME, target_id: String(newRecord.id), action: "CREATE",
          payload: { ...payload, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });

        await newRecord.update({ lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: MODULE_NAME, karyawanId: actorId, token: owlToken });
        } catch (owlError) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await t.commit();
      return { success: true, isDraft: false, data: newRecord };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      if (file && file.filename) deleteSingleFile(file.filename);
      throw error;
    }
  }

  async updateManagement({ id, userRole, body, file, actorId, owlToken }) {
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
        const notrans = await generateNotrans(NOTRANS_PREFIX);
        const ticketToClear = previous_notrans || person.lock_ticket;
        if (ticketToClear) {
          await ApprovalDraft.update({ status: "Replaced" }, { where: { notrans: ticketToClear, module_name: MODULE_NAME }, transaction: t });
        }

        await ApprovalDraft.create({
          notrans, module_name: MODULE_NAME, target_id: String(id), action: "UPDATE",
          payload: { ...payload, status: "Published" }, created_by: actorId, status: "Pending",
        }, { transaction: t });

        await person.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: MODULE_NAME, karyawanId: actorId, token: owlToken });
        } catch (owlError) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, target_id: String(id), status: ["Pending", "Rejected"] }, transaction: t });
      await person.update({ ...payload, is_locked: false, lock_ticket: null }, { transaction: t });
      await t.commit();

      if (filesToDelete.length > 0) filesToDelete.forEach((f) => deleteSingleFile(f));
      
      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      if (file && file.filename) deleteSingleFile(file.filename);
      throw error;
    }
  }

  async deleteManagement({ id, userRole, actorId, owlToken }) {
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
        const notrans = await generateNotrans(NOTRANS_PREFIX);
        await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, target_id: String(id), status: ["Pending", "Rejected"] }, transaction: t });
        
        await ApprovalDraft.create({
          notrans, module_name: MODULE_NAME, target_id: String(id), action: "DELETE",
          payload: { name: person.name, role: person.role, photoUrl: person.photoUrl }, created_by: actorId, status: "Pending",
        }, { transaction: t });

        await person.update({ is_locked: true, lock_ticket: notrans }, { transaction: t });
        await t.commit();

        try {
          await ErpApprovalService.initiateApproval({ notrans, moduleName: MODULE_NAME, karyawanId: actorId, token: owlToken });
        } catch (e) {}

        return { success: true, isDraft: true, ticket: notrans };
      }

      await invalidateOldDrafts(MODULE_NAME, id, t);
      await person.destroy({ transaction: t });
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
