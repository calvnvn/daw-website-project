const Management = require("../models/Management");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");

const getRole = (req) =>
  req.userRole ? req.userRole.toLowerCase().trim() : "";
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
exports.createManagement = async (req, res) => {
  const t = await sequelize.transaction();
  const userRole = getRole(req);
  const photoUrl = req.file ? req.file.filename : null; // Multer sudah beri prefix TEMP_ jika Editor

  try {
    const { name, role, description, level, order, status } = req.body;
    const managementData = {
      name,
      role,
      description,
      level: level || "division",
      order: parseInt(order) || 1,
      photoUrl,
    };

    // --- JALUR EDITOR: TWO-PHASE (LOCAL FIRST, THEN NETWORK) ---
    if (userRole === "editor" && status === "Published") {
      // Phase 1: Buat record lokal dalam keadaan terkunci
      const newDraftRecord = await Management.create(
        { ...managementData, is_locked: true },
        { transaction: t },
      );

      // Phase 2: Hubungi OWL
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: Management,
          targetId: newDraftRecord.id, // Sekarang kita punya ID
          action: "CREATE",
          payload: managementData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        await newDraftRecord.update(
          { lock_ticket: result.notrans },
          { transaction: t },
        );
        await t.commit();

        return res.status(202).json({
          message: "Permintaan tambah anggota dikirim.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        await t.rollback();
        if (photoUrl) deleteSingleFile(photoUrl); // Hapus file TEMP_ karena draf gagal
        throw owlError;
      }
    }

    // --- JALUR SUPERADMIN: DIRECT CREATE ---
    const newPerson = await Management.create(managementData, {
      transaction: t,
    });
    await t.commit();
    res
      .status(201)
      .json({ message: "Anggota berhasil ditambahkan!", data: newPerson });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// 3. PUT: Update Management (Resubmission & Asset Cleanup)
exports.updateManagement = async (req, res) => {
  const t = await sequelize.transaction();
  const userRole = getRole(req);
  const { id } = req.params;

  try {
    const {
      name,
      role,
      description,
      level,
      order,
      removePhoto,
      status,
      previous_notrans,
    } = req.body;
    const person = await Management.findByPk(id, { transaction: t });

    if (!person) {
      await t.rollback();
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    // Safety Check: Lock Guard
    if (person.is_locked && userRole === "editor") {
      await t.rollback();
      return res
        .status(423)
        .json({ message: "Data terkunci.", ticket: person.lock_ticket });
    }

    let finalPhotoUrl = person.photoUrl;
    let oldPhotoToDelete = null;

    if (req.file) {
      oldPhotoToDelete = person.photoUrl;
      finalPhotoUrl = req.file.filename;
    } else if (removePhoto === "true") {
      oldPhotoToDelete = person.photoUrl;
      finalPhotoUrl = null;
    }

    const updatedData = {
      name: name || person.name,
      role: role || person.role,
      description: description || person.description,
      level: level || person.level,
      order: parseInt(order) || person.order,
      photoUrl: finalPhotoUrl,
    };

    // --- JALUR EDITOR: REQUEST UPDATE ---
    if (userRole === "editor" && status === "Published") {
      // A. Cleanup Draf Lama
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      // B. Network Call
      const result = await ErpApprovalService.initiateApproval({
        model: Management,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      // C. Set Lock
      await person.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );
      await t.commit();

      return res
        .status(202)
        .json({ message: "Draf revisi dikirim.", ticket: result.notrans });
    }

    // --- JALUR SUPERADMIN: DIRECT UPDATE ---
    // Cleanup physical file jika Superadmin ganti/hapus foto
    if (oldPhotoToDelete) deleteSingleFile(oldPhotoToDelete);

    await person.update(
      { ...updatedData, is_locked: false, lock_ticket: null },
      { transaction: t },
    );
    await t.commit();

    res.status(200).json({ message: "Data berhasil diperbarui langsung!" });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// 4. DELETE: Management (Row-Level Locking)
exports.deleteManagement = async (req, res) => {
  const t = await sequelize.transaction();
  const userRole = getRole(req);

  try {
    const person = await Management.findByPk(req.params.id, { transaction: t });
    if (!person) {
      await t.rollback();
      return res.status(404).json({ message: "Data tidak ditemukan." });
    }

    if (person.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Gagal menghapus. Data terkunci.",
        ticket: person.lock_ticket,
      });
    }

    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: Management,
        targetId: person.id,
        action: "DELETE",
        payload: { name: person.name },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      await person.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );
      await t.commit();
      return res
        .status(202)
        .json({ message: "Permintaan hapus dikirim.", ticket: result.notrans });
    }

    // Superadmin: Langsung musnahkan
    if (person.photoUrl) deleteSingleFile(person.photoUrl);
    await person.destroy({ transaction: t });
    await t.commit();
    res.status(200).json({ message: "Data berhasil dihapus." });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};
