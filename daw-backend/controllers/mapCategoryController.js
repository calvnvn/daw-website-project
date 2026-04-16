const MapCategory = require("../models/MapCategory");
const ErpApprovalService = require("../services/erpApprovalService");

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await MapCategory.findAll({ order: [["name", "ASC"]] });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  const { id, name, color, status } = req.body;
  const t = await sequelize.transaction();

  try {
    // 1. Cek Duplikasi di Tabel Utama & Draft (Agar ID unique tetap terjaga)
    const existing = await MapCategory.findByPk(id, { transaction: t });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: "ID Kategori sudah digunakan!" });
    }

    // 2. PRE-INSERT STRATEGY
    const isEditor = req.userRole?.toLowerCase() === "editor";
    const categoryData = {
      id,
      name,
      color,
      is_locked: isEditor, // Langsung gembok kalau Editor
    };

    await MapCategory.create(categoryData, { transaction: t });

    // 3. EDITOR GATE
    if (isEditor && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: MapCategory,
        targetId: id,
        action: "PRE_INSERT_CREATE", // Menggunakan action khusus sesuai SOP
        payload: categoryData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token, // Gunakan token dari middleware
        transaction: t,
      });

      await t.commit();
      return res.status(202).json({
        message: "Reservasi kategori berhasil. Permintaan dikirim ke OWL.",
        ticket: result.notrans,
      });
    }

    // 4. SUPERADMIN FLOW
    await t.commit();
    res.status(201).json({ message: "Kategori berhasil dibuat permanen." });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// UPDATE
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, color, status } = req.body;
  const t = await sequelize.transaction();

  try {
    // 1. CHECK LOCK + PESSIMISTIC LOCKING
    const category = await MapCategory.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!category) {
      await t.rollback();
      return res.status(404).json({ message: "Category not found" });
    }

    if (category.is_locked) {
      await t.rollback();
      return res.status(423).json({
        message: "Gagal update. Data sedang dikunci proses approval.",
        ticket: category.lock_ticket,
      });
    }

    // 2. EDITOR GATE
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: MapCategory,
        targetId: id,
        action: "UPDATE",
        payload: { name, color },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
        transaction: t,
      });

      await t.commit();
      return res.status(202).json({
        message: "Revisi kategori dikirim ke OWL. Data dikunci.",
        ticket: result.notrans,
      });
    }

    // 3. SUPERADMIN FLOW
    await category.update({ name, color }, { transaction: t });
    await t.commit();
    res.status(200).json({ message: "Kategori diperbarui!" });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// DELETE
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  const t = await sequelize.transaction();

  try {
    // 1. CHECK LOCK
    const category = await MapCategory.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!category) {
      await t.rollback();
      return res.status(404).json({ message: "Category not found" });
    }

    if (category.is_locked) {
      await t.rollback();
      return res
        .status(423)
        .json({ message: "Hapus gagal. Data sedang terkunci." });
    }

    // 2. EDITOR GATE
    if (req.userRole?.toLowerCase() === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: MapCategory,
        targetId: id,
        action: "DELETE",
        payload: { name: category.name },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
        transaction: t,
      });

      await t.commit();
      return res.status(202).json({
        message: "Permintaan hapus dikirim ke OWL.",
        ticket: result.notrans,
      });
    }

    // 3. SUPERADMIN FLOW
    await category.destroy({ transaction: t });
    await t.commit();
    res.status(200).json({ message: "Category deleted!" });
  } catch (error) {
    if (t) await t.rollback();
    const msg =
      error.name === "SequelizeForeignKeyConstraintError"
        ? "Gagal hapus! Kategori ini masih digunakan oleh titik peta (markers)."
        : error.message;
    res.status(400).json({ message: msg });
  }
};
