const sequelize = require("../config/database");
const Management = require("../models/Management");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "Management";
const NOTRANS_PREFIX = "MGT";
/**
 * Controller: Management (Direksi)
 * Manages organizational hierarchy records with a hybrid staging-to-live workflow.
 */

const getRole = (req) =>
  req.userRole ? req.userRole.toLowerCase().trim() : "";

// Map incoming payload and manage physical photo asset lifecycle
const processManagementPayload = async (req, existingData = {}) => {
  const { name, role, description, level, order, removePhoto } = req.body;
  let filesToDelete = [];

  let finalPhotoUrl = existingData.photoUrl || null;
  if (req.file) {
    if (existingData.photoUrl) filesToDelete.push(existingData.photoUrl);
    finalPhotoUrl = req.file.filename;
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
      description:
        description !== undefined
          ? description.trim()
          : existingData.description || "",
      level: finalLevel,
      order: finalOrder,
      photoUrl: finalPhotoUrl,
    },
    filesToDelete,
  };
};

// Retrieve all records with dynamic rejection flags via subquery
exports.getAllManagements = async (req, res) => {
  try {
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

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("🚨 [GET MANAGEMENT ERROR]:", error.message);
    res.status(500).json({ message: "Gagal mengambil data management." });
  }
};

// Handle record creation with conditional staging for Editor roles
exports.createManagement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { status } = req.body;

    const { payload } = await processManagementPayload(req, {});
    const isEditor = userRole === "editor" && status === "Published";

    const newRecord = await Management.create(
      { ...payload, is_locked: isEditor, lock_ticket: null },
      { transaction: t },
    );

    // Flow Editor: Lock record and stage for ERP approval
    if (isEditor) {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(newRecord.id),
          action: "CREATE",
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await newRecord.update({ lock_ticket: notrans }, { transaction: t });

      await t.commit();
      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error(
          `🚨 [ERP SYNC FAILED] Ticket ${notrans}:`,
          owlError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan tambah anggota direksi/manajemen dikirim.",
        ticket: notrans,
      });
    }

    // Flow Admin: Direct commit
    await t.commit();
    return res.status(201).json({
      success: true,
      message: "Anggota berhasil ditambahkan secara live!",
      data: newRecord,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();

    if (req.file && req.file.filename) {
      deleteSingleFile(req.file.filename);
    }

    console.error("🚨 [CREATE MANAGEMENT ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle record updates with concurrency locking and staging logic
exports.updateManagement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { id } = req.params;
    const { status, previous_notrans } = req.body;

    const person = await Management.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!person) {
      await t.rollback();
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    if (person.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Akses ditolak. Data sedang dikunci oleh proses approval OWL.",
        ticket: person.lock_ticket,
      });
    }

    const { payload, filesToDelete } = await processManagementPayload(
      req,
      person,
    );
    const isEditor = userRole === "editor" && status === "Published";

    // Flow Editor: Generate draft and assert record lock
    if (isEditor) {
      const notrans = await generateNotrans(NOTRANS_PREFIX);
      const ticketToClear = previous_notrans || person.lock_ticket;

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

      await person.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await t.commit();
      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error(
          `🚨 [ERP SYNC FAILED] Ticket ${notrans}:`,
          owlError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Draf revisi manajemen dikirim.",
        ticket: notrans,
      });
    }

    // Flow Admin: Invalidate drafts and direct update
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

    await person.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();

    if (filesToDelete.length > 0) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
    }

    return res
      .status(200)
      .json({ success: true, message: "Data manajemen berhasil diperbarui!" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();

    if (req.file && req.file.filename) {
      deleteSingleFile(req.file.filename);
    }

    console.error("🚨 [UPDATE MANAGEMENT ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Handle record deletion with conditional staging or direct purging
exports.deleteManagement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { id } = req.params;

    const person = await Management.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!person) {
      await t.rollback();
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    if (person.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Gagal menghapus. Data sedang dalam proses approval OWL.",
        ticket: person.lock_ticket,
      });
    }

    const photoToDelete = person.photoUrl;

    // Flow Editor: Stage deletion request and lock record
    if (userRole === "editor") {
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
            name: person.name,
            role: person.role,
            photoUrl: person.photoUrl,
          },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await person.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await t.commit();

      // EXTERNAL HANDSHAKE
      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (e) {
        console.error(`🚨 [ERP SYNC FAILED] Ticket ${notrans}:`, e.message);
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus dikirim. Data dikunci.",
        ticket: notrans,
      });
    }

    // Flow Admin: Direct purge and physical asset deletion
    await invalidateOldDrafts(MODULE_NAME, id, t);
    await person.destroy({ transaction: t });
    await t.commit();
    if (photoToDelete) {
      deleteSingleFile(photoToDelete);
    }
    res.status(200).json({
      success: true,
      message: "Data berhasil dihapus secara permanen.",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();

    console.error("🚨 [DELETE MANAGEMENT ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
