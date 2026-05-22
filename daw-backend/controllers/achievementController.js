const sequelize = require("../config/database");
const Achievement = require("../models/Achievement");
const NewsArticle = require("../models/NewsArticle");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "Achievement";
const NOTRANS_PREFIX = "ACM";

const getRole = (req) => (req.userRole ? req.userRole.toLowerCase().trim() : "");

/**
 * ACHIEVEMENT CONTROLLER (Phase II: Atomic Bureaucracy)
 * Manages achievement records, including data mutation, media lifecycle, and staging workflow.
 */

// Retrieve all achievements ordered by year and ID in descending order
exports.getAllAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.findAll({
      include: [
        {
          model: NewsArticle,
          as: "newsArticle",
          attributes: ["id", "title", "slug", "status"],
          required: false,
        },
      ],
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) > 0 
              FROM ApprovalDrafts 
              WHERE ApprovalDrafts.target_id = Achievement.id COLLATE utf8mb4_unicode_ci 
              AND ApprovalDrafts.module_name = '${MODULE_NAME}' 
              AND ApprovalDrafts.status = 'Rejected'
            )`),
            "hasRejected",
          ],
        ],
      },
      order: [
        ["year", "DESC"],
        ["id", "DESC"],
      ],
    });

    const formattedData = achievements.map((m) => {
      const item = m.toJSON();
      item.hasRejected = !!item.hasRejected;
      return item;
    });

    res.status(200).json({ success: true, data: formattedData });
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

// Orchestrate creation of a new achievement record with support for single media upload and conditional staging
exports.createAchievement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { year, title, category, iconId, date, description, status, news_article_id } = req.body;

    const imageUrl = req.file ? req.file.filename : null;
    const isEditor = userRole === "editor" && status === "Published";

    const newAchievement = await Achievement.create(
      {
        year,
        title,
        category,
        iconId: iconId || "star",
        date,
        description,
        imageUrl,
        news_article_id: news_article_id || null,
        is_locked: isEditor,
        lock_ticket: null,
      },
      { transaction: t },
    );

    // Flow Editor: Lock record and stage for ERP approval
    if (isEditor) {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(newAchievement.id),
          action: "CREATE",
          payload: {
            year,
            title,
            category,
            iconId: iconId || "star",
            date,
            description,
            imageUrl,
            status: "Published",
          },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await newAchievement.update({ lock_ticket: notrans }, { transaction: t });
      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error(`🚨 [ERP SYNC FAILED] Ticket ${notrans}:`, owlError.message);
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan tambah penghargaan dikirim.",
        ticket: notrans,
      });
    }

    // Flow Admin: Direct commit
    await t.commit();
    return res.status(201).json({
      success: true,
      message: "Penghargaan berhasil ditambahkan secara live!",
      data: newAchievement,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    if (req.file) deleteSingleFile(req.file.filename);
    console.error("🚨 [CREATE ACHIEVEMENT ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Orchestrate updating an achievement record, handling database transaction, media swaps, and concurrency locking
exports.updateAchievement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { id } = req.params;
    const { year, title, category, iconId, date, description, removePhoto, status, previous_notrans, news_article_id } = req.body;

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

    if (achievement.is_locked && userRole === "editor") {
      await t.rollback();
      if (req.file) deleteSingleFile(req.file.filename);
      return res.status(423).json({
        message: "Akses ditolak. Data sedang dikunci oleh proses approval OWL.",
        ticket: achievement.lock_ticket,
      });
    }

    // Manage image swap or deletion lifecycle logic
    let finalImageUrl = achievement.imageUrl;
    let oldImageToDelete = null;

    if (req.file) {
      oldImageToDelete = achievement.imageUrl;
      finalImageUrl = req.file.filename;
    } else if (removePhoto === "true" || removePhoto === true) {
      oldImageToDelete = achievement.imageUrl;
      finalImageUrl = null;
    }

    const payload = {
      year: year || achievement.year,
      title: title || achievement.title,
      category: category || achievement.category,
      iconId: iconId || achievement.iconId,
      date: date || achievement.date,
      description: description || achievement.description,
      imageUrl: finalImageUrl,
      news_article_id: news_article_id !== undefined ? (news_article_id || null) : achievement.news_article_id,
    };

    const isEditor = userRole === "editor" && status === "Published";

    // Flow Editor: Generate draft and assert record lock
    if (isEditor) {
      const notrans = await generateNotrans(NOTRANS_PREFIX);
      const ticketToClear = previous_notrans || achievement.lock_ticket;

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

      await achievement.update(
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
        console.error(`🚨 [ERP SYNC FAILED] Ticket ${notrans}:`, owlError.message);
      }

      return res.status(202).json({
        success: true,
        message: "Draf revisi penghargaan dikirim.",
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

    await achievement.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();

    if (oldImageToDelete) deleteSingleFile(oldImageToDelete);

    res.status(200).json({
      success: true,
      message: "Penghargaan berhasil diperbarui!",
      data: achievement,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    if (req.file) deleteSingleFile(req.file.filename);
    console.error("🚨 [UPDATE ACHIEVEMENT ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Orchestrate deletion of an achievement record with conditional staging or direct purging
exports.deleteAchievement = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
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

    if (achievement.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Gagal menghapus. Data sedang dalam proses approval OWL.",
        ticket: achievement.lock_ticket,
      });
    }

    const imageToDelete = achievement.imageUrl;

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
            year: achievement.year,
            title: achievement.title,
            imageUrl: achievement.imageUrl,
          },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await achievement.update(
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
    await achievement.destroy({ transaction: t });
    await t.commit();

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
