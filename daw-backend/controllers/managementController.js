const Management = require("../models/Management");
const { deleteSingleFile } = require("../utils/fileRemover");
const { ErpApprovalService } = require("../services/erpApprovalService");
const ApprovalDraft = require("../models/ApprovalDraft");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const sequelize = require("../config/database");

const getRole = (req) =>
  req.userRole ? req.userRole.toLowerCase().trim() : "";

// Helper
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
      name: name || existingData.name,
      role: role || existingData.role,
      description:
        description !== undefined ? description : existingData.description,
      level: finalLevel,
      order: finalOrder,
      photoUrl: finalPhotoUrl,
    },
    filesToDelete,
  };
};
// 1. GET ALL: Tampilkan semua data (Termasuk yang is_locked)
exports.getAllManagements = async (req, res) => {
  try {
    const managements = await Management.findAll({
      attributes: [
        "id",
        "name",
        "role",
        "description",
        "level",
        "order",
        "photoUrl",
        "is_locked",
        "lock_ticket",
      ],
      order: [
        ["level", "ASC"],
        ["order", "ASC"],
      ],
    });
    res.status(200).json(managements);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data management." });
  }
};

// 2. POST: Create Management (Atomic Creation)
exports.createManagement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const { status } = req.body;

    const { payload } = await processManagementPayload(req, {});

    // JALUR EDITOR: TWO-PHASE (LOCAL FIRST, THEN NETWORK)
    if (userRole === "editor" && status === "Published") {
      const newDraftRecord = await Management.create(
        { ...payload, is_locked: true },
        { transaction: t },
      );

      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Management",
        model: Management,
        targetId: newDraftRecord.id,
        action: "CREATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await newDraftRecord.update(
        { lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Permintaan tambah anggota direksi/manajemen dikirim.",
        ticket: result.notrans,
      });
    }

    // JALUR SUPERADMIN ATAU DRAFT: DIRECT CREATE
    const newPerson = await Management.create(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();
    return res.status(201).json({
      message: "Anggota berhasil ditambahkan!",
      data: newPerson,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();

    if (req.file && req.file.filename) {
      deleteSingleFile(req.file.filename);
    }

    console.error("🚨 [CREATE MANAGEMENT ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 3. PUT: Update Management (Resubmission & Asset Cleanup)
exports.updateManagement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
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

    // JALUR EDITOR: REQUEST UPDATE
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Management",
        model: Management,
        targetId: id,
        action: "UPDATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await person.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Draf revisi manajemen dikirim.",
        ticket: result.notrans,
      });
    }

    // JALUR SUPERADMIN ATAU DRAFT: DIRECT UPDATE
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts("Management", id, t);
    }

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
      .json({ message: "Data manajemen berhasil diperbarui!" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    if (req.file && req.file.filename) {
      deleteSingleFile(req.file.filename);
    }

    console.error("🚨 [UPDATE MANAGEMENT ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// 4. DELETE: Management (Standardized Shared Transaction)
exports.deleteManagement = async (req, res) => {
  const t = await sequelize.transaction();
  const userRole = getRole(req);

  try {
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

    // JALUR EDITOR: REQUEST DELETE (APPROVAL)
    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Management",
        model: Management,
        targetId: id,
        action: "DELETE",
        payload: {
          name: person.name,
          role: person.role,
          reason: "Request for permanent deletion",
        },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await person.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Permintaan hapus dikirim. Data dikunci.",
        ticket: result.notrans,
      });
    }

    // JALUR SUPERADMIN: DIRECT DELETE
    await invalidateOldDrafts("Management", id, t);
    await person.destroy({ transaction: t });

    await t.commit();

    if (photoToDelete) {
      deleteSingleFile(photoToDelete);
    }

    res.status(200).json({ message: "Data berhasil dihapus secara permanen." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();

    console.error("🚨 [DELETE MANAGEMENT ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};
