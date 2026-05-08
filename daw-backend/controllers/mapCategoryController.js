const sequelize = require("../config/database");
const MapCategory = require("../models/MapCategory");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
/**
 * Controller: Map Categories
 * Handles master data for map markers.
 * Note: This module is strictly Admin-only (no Editor staging flow).
 */

// Fetch all categories for public/admin maps
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

// Admin: Create new master category (Direct Commit)
exports.createCategory = async (req, res) => {
  const { id, name, color } = req.body;
  const t = await sequelize.transaction();

  try {
    // Validate unique ID before creation
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

// Admin: Update master category with pessimistic locking
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;
  const t = await sequelize.transaction();

  try {
    // Invalidate legacy drafts to maintain state integrity
    await invalidateOldDrafts("MapCategory", id, t);

    // Acquire pessimistic lock to prevent concurrent admin edits
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

// Admin: Delete category with referential integrity check
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

    // Catch database-level relational errors (Foreign Key Constraint)
    const msg =
      error.name === "SequelizeForeignKeyConstraintError"
        ? "Gagal hapus! Kategori ini masih digunakan oleh titik peta (markers)."
        : error.message;

    res.status(400).json({ success: false, message: msg });
  }
};
