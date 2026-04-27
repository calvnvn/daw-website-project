const sequelize = require("../config/database");
const MapCategory = require("../models/MapCategory");
const { invalidateOldDrafts } = require("../utils/draftCleanup");

/**
 * @desc    Get all Map Categories
 * @route   GET /api/map-categories
 * @access  Public / Admin
 */
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await MapCategory.findAll({
      attributes: ["id", "name", "color", "is_locked", "lock_ticket"],
      order: [["name", "ASC"]],
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 1. CREATE (ABSOLUTE ADMIN RESTRICTION) ---
exports.createCategory = async (req, res) => {
  const { id, name, color } = req.body;

  const t = await sequelize.transaction();

  try {
    const existing = await MapCategory.findByPk(id, { transaction: t });
    if (existing) {
      await t.rollback();
      return res
        .status(400)
        .json({ success: false, message: "ID Kategori sudah digunakan!" });
    }

    const categoryData = {
      id,
      name,
      color,
      is_locked: false,
    };

    await MapCategory.create(categoryData, { transaction: t });

    await t.commit();
    res
      .status(201)
      .json({ success: true, message: "Kategori berhasil dibuat permanen." });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 2. UPDATE (ABSOLUTE ADMIN RESTRAICTION) ---
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  const t = await sequelize.transaction();

  try {
    // 1. Bunuh draf lama (Mencegah Zombie Drafts dari sistem sebelum refactor)
    await invalidateOldDrafts("MapCategory", id, t);

    // 2. Pessimistic Locking
    const category = await MapCategory.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!category) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Kategori tidak ditemukan" });
    }

    await category.update(
      { name, color, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();
    res
      .status(200)
      .json({ success: true, message: "Kategori diperbarui secara permanen!" });
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 3. DELETE (ABSOLUTE ADMIN RESTRICTION) ---
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  const t = await sequelize.transaction();

  try {
    await invalidateOldDrafts("MapCategory", id, t);

    const category = await MapCategory.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!category) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Kategori tidak ditemukan" });
    }

    await category.destroy({ transaction: t });

    await t.commit();
    res
      .status(200)
      .json({ success: true, message: "Kategori berhasil dihapus!" });
  } catch (error) {
    if (t) await t.rollback();

    // Penanganan Foreign Key Constraint (Sangat Krusial)
    const msg =
      error.name === "SequelizeForeignKeyConstraintError"
        ? "Gagal hapus! Kategori ini masih digunakan oleh titik peta (markers)."
        : error.message;

    res.status(400).json({ success: false, message: msg });
  }
};
