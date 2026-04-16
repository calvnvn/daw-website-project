const sequelize = require("../config/database");
const MapCategory = require("../models/MapCategory");
// 🚀 ErpApprovalService DIHAPUS dari file ini karena kita bypass sepenuhnya.

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await MapCategory.findAll({ order: [["name", "ASC"]] });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- 1. CREATE (LANGSUNG LIVE) ---
exports.createCategory = async (req, res) => {
  const { id, name, color } = req.body; // Parameter 'status' tidak lagi relevan di sini

  // Tetap gunakan transaksi untuk atomic safety
  const t = await sequelize.transaction();

  try {
    // Cek Duplikasi (Mencegah Error 500 karena Primary Key Clash)
    const existing = await MapCategory.findByPk(id, { transaction: t });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: "ID Kategori sudah digunakan!" });
    }

    // Eksekusi langsung tanpa mengecek role Editor/Admin
    const categoryData = {
      id,
      name,
      color,
      is_locked: false, // Pastikan tidak terkunci
    };

    await MapCategory.create(categoryData, { transaction: t });

    await t.commit();
    res.status(201).json({ message: "Kategori berhasil dibuat permanen." });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// --- 2. UPDATE (LANGSUNG LIVE) ---
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  const t = await sequelize.transaction();

  try {
    // PESSIMISTIC LOCKING: Tetap dipakai untuk mencegah race condition sesama Editor
    const category = await MapCategory.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!category) {
      await t.rollback();
      return res.status(404).json({ message: "Category not found" });
    }

    // 💡 SENIOR FIX: Force is_locked menjadi false dan bersihkan lock_ticket
    // Ini berguna sebagai "Pembersih Zombie" jika sebelumnya ada data yang sempat
    // terkunci oleh sistem approval lama sebelum kita refactor ke Bypass mode.
    await category.update(
      { name, color, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();
    res.status(200).json({ message: "Kategori diperbarui secara permanen!" });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// --- 3. DELETE (LANGSUNG LIVE) ---
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  const t = await sequelize.transaction();

  try {
    const category = await MapCategory.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!category) {
      await t.rollback();
      return res.status(404).json({ message: "Category not found" });
    }

    // Langsung hancurkan data tanpa melalui OWL
    await category.destroy({ transaction: t });

    await t.commit();
    res.status(200).json({ message: "Category deleted!" });
  } catch (error) {
    if (t) await t.rollback();
    // Penanganan Foreign Key Constraint tetap dipertahankan (Sangat Krusial)
    const msg =
      error.name === "SequelizeForeignKeyConstraintError"
        ? "Gagal hapus! Kategori ini masih digunakan oleh titik peta (markers)."
        : error.message;
    res.status(400).json({ message: msg });
  }
};
