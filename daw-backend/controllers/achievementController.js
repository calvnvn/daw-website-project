const sequelize = require("../config/database");
const Achievement = require("../models/Achievement");
const { deleteSingleFile } = require("../utils/fileRemover");

/**
 * ACHIEVEMENT CONTROLLER (Phase I: Direct Commit / Bypass Approval)
 * Manages achievement records, including data mutation and media lifecycle.
 */

// Retrieve all achievements ordered by year and ID in descending order
exports.getAllAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.findAll({
      order: [
        ["year", "DESC"], // Sort by most recent year
        ["id", "DESC"],
      ],
    });

    res.status(200).json({ success: true, data: achievements });
  } catch (error) {
    console.error("🚨 [GET ALL ACHIEVEMENTS ERROR]:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Gagal memuat data penghargaan." });
  }
};

// Retrieve a specific achievement record by its primary key
exports.getAchievementById = async (req, res) => {
  try {
    const achievement = await Achievement.findByPk(req.params.id);
    if (!achievement) {
      return res
        .status(404)
        .json({ success: false, message: "Penghargaan tidak ditemukan." });
    }
    res.status(200).json({ success: true, data: achievement });
  } catch (error) {
    console.error("🚨 [GET ACHIEVEMENT BY ID ERROR]:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Gagal memuat detail penghargaan." });
  }
};

// Orchestrate creation of a new achievement record with support for single media upload
exports.createAchievement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { year, title, category, iconId, date, description } = req.body;

    // Handle image file upload payload if present
    const imageUrl = req.file ? req.file.filename : null;

    const newAchievement = await Achievement.create(
      {
        year,
        title,
        category,
        iconId: iconId || "star",
        date,
        description,
        imageUrl,
        is_locked: false, // Bypass approval queue
      },
      { transaction: t },
    );

    await t.commit();
    res.status(201).json({
      success: true,
      message: "Penghargaan berhasil ditambahkan.",
      data: newAchievement,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    // Rollback uploaded image if database transaction fails
    if (req.file) deleteSingleFile(req.file.filename);
    console.error("🚨 [CREATE ACHIEVEMENT ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Orchestrate updating an achievement record, handling database transaction and media swaps
exports.updateAchievement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { year, title, category, iconId, date, description, removePhoto } =
      req.body;

    const achievement = await Achievement.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!achievement) {
      await t.rollback();
      if (req.file) deleteSingleFile(req.file.filename);
      return res
        .status(404)
        .json({ success: false, message: "Data tidak ditemukan." });
    }

    // Manage image swap or deletion lifecycle logic
    let finalImageUrl = achievement.imageUrl;
    let oldImageToDelete = null;

    if (req.file) {
      oldImageToDelete = achievement.imageUrl; // Mark existing image for physical deletion
      finalImageUrl = req.file.filename;
    } else if (removePhoto === "true" || removePhoto === true) {
      oldImageToDelete = achievement.imageUrl;
      finalImageUrl = null;
    }

    await achievement.update(
      {
        year: year || achievement.year,
        title: title || achievement.title,
        category: category || achievement.category,
        iconId: iconId || achievement.iconId,
        date: date || achievement.date,
        description: description || achievement.description,
        imageUrl: finalImageUrl,
      },
      { transaction: t },
    );

    await t.commit();

    // Purge deprecated image file physically upon successful database commit
    if (oldImageToDelete) deleteSingleFile(oldImageToDelete);

    res.status(200).json({
      success: true,
      message: "Penghargaan berhasil diperbarui.",
      data: achievement,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    if (req.file) deleteSingleFile(req.file.filename);
    console.error("🚨 [UPDATE ACHIEVEMENT ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Orchestrate deletion of an achievement record and its associated physical media file
exports.deleteAchievement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const achievement = await Achievement.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!achievement) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Data tidak ditemukan." });
    }

    const imageToDelete = achievement.imageUrl;

    await achievement.destroy({ transaction: t });
    await t.commit();

    // Purge associated image file physically upon successful database commit
    if (imageToDelete) deleteSingleFile(imageToDelete);

    res.status(200).json({
      success: true,
      message: "Penghargaan berhasil dihapus permanen.",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [DELETE ACHIEVEMENT ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
