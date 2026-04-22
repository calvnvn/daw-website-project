const fs = require("fs");
const path = require("path");
const HeroSlides = require("../models/HeroSlides");
const HomeSettings = require("../models/HomeSettings");
const ImpactStats = require("../models/ImpactStats");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { ErpApprovalService } = require("../services/erpApprovalService");
const sequelize = require("../config/database");

const getRole = (req) =>
  req.userRole ? req.userRole.toLowerCase().trim() : "";

const applyTempPrefix = (fileObj) => {
  if (!fileObj) return null;
  const newFilename = `TEMP_${fileObj.filename}`;
  const newPath = path.join(fileObj.destination, newFilename);

  try {
    fs.renameSync(fileObj.path, newPath);
    return newFilename;
  } catch (err) {
    console.error(
      `🚨 [FILE SYSTEM] Gagal me-rename file ke TEMP_: ${err.message}`,
    );
    return fileObj.filename; // Fallback ke nama asli jika gagal
  }
};

// 1. GET ALL HOMEPAGE DATA
exports.getHomepageData = async (req, res) => {
  try {
    const lockAttributes = ["is_locked", "lock_ticket"];

    const [slides, stats, settings] = await Promise.all([
      HeroSlides.findAll({
        attributes: [
          "id",
          "title",
          "subtitle",
          "imageUrl",
          "order",
          ...lockAttributes,
        ],
        order: [["order", "ASC"]],
      }),
      ImpactStats.findAll({
        attributes: [
          "id",
          "icon",
          "value",
          "label",
          "desc",
          "order",
          ...lockAttributes,
        ],
        order: [["order", "ASC"]],
      }),
      HomeSettings.findByPk(1, {
        attributes: ["introHeadline", "introBody", ...lockAttributes],
      }),
    ]);

    let currentSettings = settings;
    if (!currentSettings) {
      currentSettings = await HomeSettings.create({
        id: 1,
        introHeadline: "A Transformation Company.",
        introBody: "Welcome to DAW.",
        is_locked: false,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        slides,
        stats,
        settings: currentSettings ? currentSettings.get({ plain: true }) : null,
      },
    });
  } catch (error) {
    console.error("🚨 Error GET Homepage Data:", error);
    res.status(500).json({
      success: false, // 🚀 STEP 1: STANDARISASI ERROR
      message: "Gagal mengambil data beranda",
      error: error.message,
    });
  }
};

// 2. UPDATE HOME SETTINGS (SINGLETON)
exports.updateSettings = async (req, res) => {
  try {
    const userRole = getRole(req);
    const { introHeadline, introBody, status, previous_notrans } = req.body;

    let settings = await HomeSettings.findByPk(1);
    if (!settings) settings = await HomeSettings.create({ id: 1 });

    // 🔒 THE GATEKEEPER
    if (userRole === "editor" && settings.is_locked) {
      return res.status(423).json({
        success: false,
        message: "Akses Dibatasi. Intro sedang dikunci oleh proses approval.",
        ticket: settings.lock_ticket,
      });
    }

    // --- JALUR SUPERADMIN (SOVEREIGN BYPASS) ---
    if (userRole === "superadmin" || userRole === "admin") {
      const t = await sequelize.transaction();
      try {
        // The Atomic Draft Killer
        await invalidateOldDrafts("HomeSettings", 1, t);

        await settings.update(
          {
            introHeadline,
            introBody,
            is_locked: false,
            lock_ticket: null,
          },
          { transaction: t },
        );

        await t.commit();

        return res.status(200).json({
          success: true,
          message: "Intro diperbarui secara live!",
          data: settings,
        });
      } catch (dbError) {
        await t.rollback();
        throw dbError;
      }
    }

    // --- JALUR EDITOR (HANDSHAKE TO ERP) ---
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      // Pastikan ERP Orchestrator siap dengan error handling
      const result = await ErpApprovalService.initiateApproval({
        model: HomeSettings,
        targetId: 1,
        action: "UPDATE",
        payload: { introHeadline, introBody },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      await settings.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        success: true,
        message: "Revisi intro homepage berhasil diajukan.",
        ticket: result.notrans,
      });
    }

    return res
      .status(403)
      .json({ success: false, message: "Role tidak memiliki akses." });
  } catch (error) {
    console.error("🚨 ERROR UPDATE SETTINGS:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. HERO SLIDES (COLLECTION)
exports.createHeroSlide = async (req, res) => {
  let newSlide = null;
  const userRole = getRole(req);

  try {
    const { title, subtitle, order, status, previous_notrans } = req.body;
    const uploadedImage = req.file ? req.file : null;

    const slideData = {
      title,
      subtitle,
      order,
      imageUrl: null,
      is_locked: false, // Default
    };

    // 1. File Handling (Prefix TEMP_ jika Editor)
    if (uploadedImage) {
      slideData.imageUrl =
        userRole === "editor"
          ? applyTempPrefix(uploadedImage)
          : uploadedImage.filename;
    }

    // 2. PHASE 1: LOCAL TRANSACTION (Membuat entitas wujud fisik)
    const t = await sequelize.transaction();
    try {
      if (userRole === "editor") slideData.is_locked = true; // Terlahir terkunci
      newSlide = await HeroSlides.create(slideData, { transaction: t });
      await t.commit();
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }

    // 3. PHASE 2: JALUR EDITOR (HANDSHAKE TO ERP)
    if (userRole === "editor" && status === "Published") {
      try {
        if (previous_notrans) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            { where: { notrans: previous_notrans } },
          );
        }

        const result = await ErpApprovalService.initiateApproval({
          model: HeroSlides,
          targetId: newSlide.id, // 🚀 SEKARANG PUNYA ID!
          action: "CREATE",
          payload: slideData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        await newSlide.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Permintaan slide baru berhasil diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error(
          `🚨 [CLEANUP] ERP Gagal. Menghapus orphan Slide ID: ${newSlide.id}`,
        );
        await newSlide.destroy();
        if (slideData.imageUrl) deleteSingleFile(slideData.imageUrl);
        throw owlError;
      }
    }

    // --- JALUR SUPERADMIN ---
    res
      .status(201)
      .json({ success: true, message: "Slide created live", data: newSlide });
  } catch (error) {
    console.error("🚨 ERROR CREATE SLIDE:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateHeroSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = getRole(req);
    const { title, subtitle, order, status, previous_notrans } = req.body;

    const slide = await HeroSlides.findByPk(id);
    if (!slide)
      return res
        .status(404)
        .json({ success: false, message: "Slide not found" });

    // 🔒 THE GATEKEEPER
    if (userRole === "editor" && slide.is_locked) {
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Slide ini sedang dikunci oleh proses approval.",
        ticket: slide.lock_ticket,
      });
    }

    let newImageUrl = slide.imageUrl;
    let oldImageToDelete = null;

    if (req.file) {
      oldImageToDelete = slide.imageUrl;
      // 🚀 Gunakan helper TEMP_ prefix jika user adalah editor
      newImageUrl =
        userRole === "editor" ? applyTempPrefix(req.file) : req.file.filename;
    }

    const updatedData = { title, subtitle, order, imageUrl: newImageUrl };

    // --- JALUR SUPERADMIN (SOVEREIGN BYPASS) ---
    if (userRole === "superadmin" || userRole === "admin") {
      const t = await sequelize.transaction();
      try {
        // 1. The Atomic Draft Killer
        await invalidateOldDrafts("HeroSlides", id, t);

        // 2. Lock & Update Local Data
        await slide.update(
          {
            ...updatedData,
            is_locked: false,
            lock_ticket: null,
          },
          { transaction: t },
        );

        await t.commit();

        // 3. Final Physical Asset Management (Eksekusi setelah Commit sukses)
        if (oldImageToDelete) deleteSingleFile(oldImageToDelete);

        return res
          .status(200)
          .json({ success: true, message: "Slide updated live!", data: slide });
      } catch (dbError) {
        await t.rollback();
        throw dbError;
      }
    }

    // --- JALUR EDITOR ---
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      try {
        const result = await ErpApprovalService.initiateApproval({
          model: HeroSlides,
          targetId: id,
          action: "UPDATE",
          payload: updatedData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        await slide.update({ is_locked: true, lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Revisi slide berhasil diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        if (req.file && newImageUrl) deleteSingleFile(newImageUrl);
        throw owlError;
      }
    }
  } catch (error) {
    console.error("🚨 ERROR UPDATE SLIDE:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteHeroSlide = async (req, res) => {
  try {
    const userRole = getRole(req);
    const { id } = req.params;
    const slide = await HeroSlides.findByPk(id);

    if (!slide)
      return res
        .status(404)
        .json({ success: false, message: "Slide not found" });

    // 🔒 THE GATEKEEPER
    if (userRole === "editor" && slide.is_locked) {
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Slide sedang terkunci dan tidak bisa dihapus.",
        ticket: slide.lock_ticket,
      });
    }

    // --- JALUR SUPERADMIN (SOVEREIGN BYPASS) ---
    if (userRole === "superadmin" || userRole === "admin") {
      const t = await sequelize.transaction();
      try {
        // 1. The Atomic Draft Killer
        await invalidateOldDrafts("HeroSlides", id, t);

        await slide.destroy({ transaction: t });
        await t.commit();

        // 2. Hapus aset fisik SETELAH data DB musnah
        if (slide.imageUrl) deleteSingleFile(slide.imageUrl);

        return res
          .status(200)
          .json({ success: true, message: "Slide deleted live!" });
      } catch (dbError) {
        await t.rollback();
        throw dbError;
      }
    }

    // --- JALUR EDITOR ---
    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: HeroSlides,
        targetId: slide.id,
        action: "DELETE",
        payload: { title: slide.title },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      await slide.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus slide diajukan.",
        ticket: result.notrans,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. IMPACT STATS (Granular Row Lock)
exports.createStat = async (req, res) => {
  let newStat = null;
  const userRole = getRole(req);

  try {
    const count = await ImpactStats.count();
    if (count >= 4) {
      return res.status(400).json({
        success: false,
        message: "Maksimal hanya 4 statistik!",
      });
    }

    const { icon, value, label, desc, order, status, previous_notrans } =
      req.body;
    const statData = { icon, value, label, desc, order, is_locked: false };

    // 1. PHASE 1: LOCAL TRANSACTION (Membuat entitas wujud fisik)
    const t = await sequelize.transaction();
    try {
      if (userRole === "editor") statData.is_locked = true; // Terlahir terkunci
      newStat = await ImpactStats.create(statData, { transaction: t });
      await t.commit();
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }

    // 2. PHASE 2: JALUR EDITOR (HANDSHAKE TO ERP)
    if (userRole === "editor" && status === "Published") {
      try {
        if (previous_notrans) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            { where: { notrans: previous_notrans } },
          );
        }

        const result = await ErpApprovalService.initiateApproval({
          model: ImpactStats,
          targetId: newStat.id,
          action: "CREATE",
          payload: statData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        await newStat.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Permintaan statistik baru berhasil diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        // 🛡️ ORPHAN GUARD: Bersihkan data lokal jika ERP gagal merespons
        console.error(
          `🚨 [CLEANUP] ERP Gagal. Menghapus orphan Stat ID: ${newStat.id}`,
        );
        await newStat.destroy();
        throw owlError;
      }
    }

    // --- JALUR SUPERADMIN ---
    res
      .status(201)
      .json({ success: true, message: "Stat created live", data: newStat });
  } catch (error) {
    console.error("🚨 ERROR CREATE STAT:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStat = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = getRole(req);
    const { icon, value, label, desc, order, status, previous_notrans } =
      req.body;

    const stat = await ImpactStats.findByPk(id);
    if (!stat)
      return res
        .status(404)
        .json({ success: false, message: "Stat not found" });

    // 🔒 THE GATEKEEPER
    if (userRole === "editor" && stat.is_locked) {
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Statistik ini sedang dikunci oleh proses approval.",
        ticket: stat.lock_ticket,
      });
    }

    const updatedData = { icon, value, label, desc, order };

    // --- JALUR SUPERADMIN (SOVEREIGN BYPASS) ---
    if (userRole === "superadmin" || userRole === "admin") {
      const t = await sequelize.transaction();
      try {
        // 1. The Atomic Draft Killer
        await invalidateOldDrafts("ImpactStats", id, t);

        // 2. Lock & Update Local Data
        await stat.update(
          {
            ...updatedData,
            is_locked: false,
            lock_ticket: null,
          },
          { transaction: t },
        );

        await t.commit();

        return res.status(200).json({
          success: true,
          message: "Statistik updated live!",
          data: stat,
        });
      } catch (dbError) {
        await t.rollback();
        throw dbError;
      }
    }

    // --- JALUR EDITOR ---
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: ImpactStats,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      await stat.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        success: true,
        message: "Revisi statistik berhasil diajukan.",
        ticket: result.notrans,
      });
    }
  } catch (error) {
    console.error("🚨 ERROR UPDATE STAT:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteStat = async (req, res) => {
  try {
    const userRole = getRole(req);
    const stat = await ImpactStats.findByPk(req.params.id);
    if (!stat)
      return res
        .status(404)
        .json({ success: false, message: "Stat not found" });

    // 🔒 THE GATEKEEPER
    if (userRole === "editor" && stat.is_locked) {
      return res.status(423).json({
        success: false,
        message: "Akses Dibatasi. Gagal menghapus karena data sedang terkunci.",
        ticket: stat.lock_ticket,
      });
    }

    // --- JALUR SUPERADMIN (SOVEREIGN BYPASS) ---
    if (userRole === "superadmin" || userRole === "admin") {
      const t = await sequelize.transaction();
      try {
        // 1. The Atomic Draft Killer
        await invalidateOldDrafts("ImpactStats", stat.id, t);

        // 2. Destroy Data
        await stat.destroy({ transaction: t });
        await t.commit();

        return res
          .status(200)
          .json({ success: true, message: "Statistik deleted live!" });
      } catch (dbError) {
        await t.rollback();
        throw dbError;
      }
    }

    // --- JALUR EDITOR ---
    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: ImpactStats,
        targetId: stat.id,
        action: "DELETE",
        payload: { label: stat.label },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      await stat.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus statistik diajukan.",
        ticket: result.notrans,
      });
    }
  } catch (error) {
    console.error("🚨 ERROR DELETE STAT:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
