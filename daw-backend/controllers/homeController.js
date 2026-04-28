const fs = require("fs");
const path = require("path");
const HeroSlides = require("../models/HeroSlides");
const HomeSettings = require("../models/HomeSettings");
const ImpactStats = require("../models/ImpactStats");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const ErpApprovalService = require("../services/erpApprovalService");
const sequelize = require("../config/database");

const getRole = (req) =>
  req.userRole ? req.userRole.toLowerCase().trim() : "";

const applyTempPrefix = (fileObj) => {
  if (!fileObj || !fileObj.filename) {
    console.error(
      "🚨 [TEMP GUARD] Objek file tidak valid atau filename hilang.",
    );
    return null;
  }

  const filename = fileObj.filename;

  if (filename.startsWith("TEMP_")) {
    return filename;
  }

  const uploadDir = path.join(__dirname, "..", "public", "uploads");

  const oldPath = fileObj.path || path.join(uploadDir, filename);

  const newFilename = `TEMP_${filename}`;
  const newPath = path.join(uploadDir, newFilename);

  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`✅ [TEMP GUARD] Success: ${filename} -> ${newFilename}`);
      return newFilename;
    } else {
      console.warn(`⚠️ [TEMP GUARD] File fisik tidak ditemukan di: ${oldPath}`);
      return filename;
    }
  } catch (err) {
    console.error(`🚨 [TEMP GUARD ERROR] Gagal me-rename file: ${err.message}`);
    return filename;
  }
};

// GET ALL HOMEPAGE DATA (Discovery & Rejection Radar)
exports.getHomepageData = async (req, res) => {
  try {
    const lockAttributes = ["is_locked", "lock_ticket"];
    const actorId = String(req.owl_username || req.karyawanId || "");

    const results = await Promise.allSettled([
      HeroSlides.findAll({
        order: [["order", "ASC"]],
        attributes: { include: lockAttributes },
      }),
      ImpactStats.findAll({
        order: [["order", "ASC"]],
        attributes: { include: lockAttributes },
      }),
      HomeSettings.findByPk(1, { attributes: { include: lockAttributes } }),
      ApprovalDraft.findAll({
        where: {
          module_name: ["HeroSlides", "ImpactStats", "HomeSettings"],
          status: "Rejected",
          created_by: actorId,
        },
      }),
    ]);

    const slides = results[0].status === "fulfilled" ? results[0].value : [];
    const stats = results[1].status === "fulfilled" ? results[1].value : [];
    let settings = results[2].status === "fulfilled" ? results[2].value : null;
    const rejections =
      results[3].status === "fulfilled" ? results[3].value : [];

    if (!settings && results[2].status === "fulfilled") {
      settings = await HomeSettings.create({
        id: 1,
        introHeadline: "A Transformation Company.",
        introBody: "Welcome to DAW.",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        slides,
        stats,
        settings,
        rejectionRadar: rejections,
      },
    });
  } catch (error) {
    console.error("🚨 [DISCOVERY ERROR]:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Gagal memuat data beranda." });
  }
};

// UPDATE HOME SETTINGS
exports.updateSettings = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const { introHeadline, introBody, status, previous_notrans } = req.body;
    const actorId = String(req.owl_username || req.karyawanId);

    // FETCH & LOCK
    let settings = await HomeSettings.findByPk(1, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!settings) {
      settings = await HomeSettings.create({ id: 1 }, { transaction: t });
    }

    // CONCURRENCY CHECK
    if (userRole === "editor" && settings.is_locked) {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message: "Data sedang dalam proses peninjauan (Locked).",
        ticket: settings.lock_ticket,
      });
    }

    if (userRole === "editor" && status === "Published") {
      await invalidateOldDrafts(1, "HomeSettings", t, previous_notrans);
      await settings.update(
        {
          is_locked: true,
          lock_ticket: "PENDING_SYNC",
        },
        { transaction: t },
      );

      await t.commit();

      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "HomeSettings",
          targetId: 1,
          action: "UPDATE",
          payload: { introHeadline, introBody },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        await settings.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Revisi diajukan ke ERP OWL.",
          ticket: result.notrans,
        });
      } catch (erpErr) {
        console.error("🚨 [ERP SYNC FAILED]:", erpErr.message);
        return res.status(202).json({
          success: true,
          message: "Data terkunci lokal, namun sinkronisasi ERP tertunda.",
          warning: erpErr.message,
        });
      }
    }

    await invalidateOldDrafts(1, "HomeSettings", t);

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
    return res
      .status(200)
      .json({ success: true, message: "Perubahan live berhasil disimpan!" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [ATOMIC FAILURE]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// HERO SLIDES (COLLECTION WITH ASSETS)
exports.createHeroSlide = async (req, res) => {
  let newSlide = null;
  const userRole = getRole(req);
  const t = await sequelize.transaction();

  try {
    const { title, subtitle, order, status } = req.body;
    const uploadedImage = req.file ? req.file : null;

    const slideData = {
      title,
      subtitle,
      order,
      imageUrl: null,
      is_locked: false,
    };

    if (uploadedImage) {
      slideData.imageUrl =
        userRole === "editor"
          ? applyTempPrefix(uploadedImage)
          : uploadedImage.filename;
    }

    if (userRole === "editor") {
      slideData.is_locked = true;
      slideData.lock_ticket = "PENDING_SYNC";
    }

    newSlide = await HeroSlides.create(slideData, { transaction: t });

    await t.commit();

    // 3EXTERNAL HANDSHAKE
    if (userRole === "editor" && status === "Published") {
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "HeroSlides",
          targetId: newSlide.id,
          action: "CREATE",
          payload: slideData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        // FINAL SYNC
        await newSlide.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Permintaan slide baru berhasil diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error(
          `🚨 [ERP FAIL] Rollback manual untuk Slide ID: ${newSlide.id}`,
        );
        await newSlide.destroy();
        if (slideData.imageUrl) deleteSingleFile(slideData.imageUrl);

        return res.status(500).json({
          success: false,
          message: "Gagal menyinkronkan dengan ERP. Pembuatan dibatalkan.",
          error: owlError.message,
        });
      }
    }

    // SUPERADMIN
    return res
      .status(201)
      .json({ success: true, message: "Slide created live", data: newSlide });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 ERROR CREATE SLIDE:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateHeroSlide = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = getRole(req);
    const { title, subtitle, order, status, previous_notrans } = req.body;

    const slide = await HeroSlides.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!slide) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Slide not found" });
    }

    if (userRole === "editor" && slide.is_locked) {
      await t.rollback();
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
      newImageUrl =
        userRole === "editor" ? applyTempPrefix(req.file) : req.file.filename;
    }

    const updatedData = { title, subtitle, order, imageUrl: newImageUrl };

    //  EDITOR
    if (userRole === "editor" && status === "Published") {
      await invalidateOldDrafts(id, "HeroSlides", t, previous_notrans);

      await slide.update(
        {
          is_locked: true,
          lock_ticket: "PENDING_SYNC",
        },
        { transaction: t },
      );

      await t.commit();

      // External Handshake
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "HeroSlides",
          targetId: id,
          action: "UPDATE",
          payload: JSON.parse(JSON.stringify(updatedData)),
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        // Update tiket aslinya
        await slide.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Revisi slide berhasil diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
        return res.status(202).json({
          success: true,
          message: "Data terkunci lokal, namun sinkronisasi ERP tertunda.",
          warning: owlError.message,
        });
      }
    }

    //  SUPERADMIN
    await invalidateOldDrafts(id, "HeroSlides", t);

    await slide.update(
      {
        ...updatedData,
        is_locked: false,
        lock_ticket: null,
      },
      { transaction: t },
    );

    await t.commit();

    if (oldImageToDelete) deleteSingleFile(oldImageToDelete);

    return res
      .status(200)
      .json({ success: true, message: "Slide updated live!", data: slide });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 ERROR UPDATE SLIDE:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteHeroSlide = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const { id } = req.params;

    const slide = await HeroSlides.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!slide) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Slide not found" });
    }

    if (userRole === "editor" && slide.is_locked) {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Slide sedang terkunci dan tidak bisa dihapus.",
        ticket: slide.lock_ticket,
      });
    }

    //  EDITOR 
    if (userRole === "editor") {
      await invalidateOldDrafts(id, "HeroSlides", t, req.body.previous_notrans);

      await slide.update(
        {
          is_locked: true,
          lock_ticket: "PENDING_SYNC",
        },
        { transaction: t },
      );

      await t.commit();

      // External Handshake
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "HeroSlides",
          targetId: slide.id,
          action: "DELETE",
          payload: { title: slide.title },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        await slide.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Permintaan hapus slide diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
        return res.status(202).json({
          success: true,
          message:
            "Slide dikunci untuk dihapus, tapi sinkronisasi ERP tertunda.",
          warning: owlError.message,
        });
      }
    }

    //  SUPERADMIN
    await invalidateOldDrafts(id, "HeroSlides", t);

    const imageToDelete = slide.imageUrl;
    await slide.destroy({ transaction: t });

    await t.commit();

    if (imageToDelete) deleteSingleFile(imageToDelete);

    return res
      .status(200)
      .json({ success: true, message: "Slide deleted live!" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    return res.status(500).json({ success: false, message: error.message });
  }
};

// IMPACT STATS (Collection - Text Only)
exports.createStat = async (req, res) => {
  let newStat = null;
  const userRole = getRole(req);
  const t = await sequelize.transaction();

  try {
    const { icon, value, label, desc, order, status } = req.body;

    const count = await ImpactStats.count({ transaction: t });
    if (count >= 4) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Maksimal hanya 4 statistik! Hapus statistik lama jika ingin menambah baru.",
      });
    }

    const statData = {
      icon: icon || "Map",
      value,
      label,
      desc,
      order,
      is_locked: false,
    };

    if (userRole === "editor") {
      statData.is_locked = true;
      statData.lock_ticket = "PENDING_SYNC";
    }

    newStat = await ImpactStats.create(statData, { transaction: t });

    await t.commit();

    // External Hanadshake (Editor)
    if (userRole === "editor" && status === "Published") {
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "ImpactStats",
          targetId: newStat.id,
          action: "CREATE",
          payload: statData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        // PFINAL SYNC
        await newStat.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Permintaan statistik baru berhasil diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error(
          `🚨 [ERP FAIL] Rollback manual untuk Stat ID: ${newStat.id}`,
        );
        await newStat.destroy();

        return res.status(500).json({
          success: false,
          message:
            "Gagal menyinkronkan dengan ERP. Pembuatan statistik dibatalkan.",
          error: owlError.message,
        });
      }
    }

    // SUPERADMIN
    return res
      .status(201)
      .json({ success: true, message: "Stat created live", data: newStat });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 ERROR CREATE STAT:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStat = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = getRole(req);
    const { icon, value, label, desc, order, status, previous_notrans } =
      req.body;

    const stat = await ImpactStats.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!stat) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Stat not found" });
    }

    if (userRole === "editor" && stat.is_locked) {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Statistik ini sedang dikunci oleh proses approval.",
        ticket: stat.lock_ticket,
      });
    }

    const updatedData = { icon, value, label, desc, order };

    //  EDITOR
    if (userRole === "editor" && status === "Published") {
      await invalidateOldDrafts(id, "ImpactStats", t, previous_notrans);

      await stat.update(
        {
          is_locked: true,
          lock_ticket: "PENDING_SYNC",
        },
        { transaction: t },
      );

      await t.commit();

      // External Handshake
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "ImpactStats",
          targetId: id,
          action: "UPDATE",
          payload: updatedData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        // Sinkronisasi tiket final
        await stat.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Revisi statistik berhasil diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
        return res.status(202).json({
          success: true,
          message: "Data terkunci lokal, namun sinkronisasi ERP tertunda.",
          warning: owlError.message,
        });
      }
    }

    //  SUPERADMIN
    await invalidateOldDrafts(id, "ImpactStats", t);

    await stat.update(
      {
        ...updatedData,
        is_locked: false,
        lock_ticket: null,
      },
      { transaction: t },
    );

    await t.commit();
    return res
      .status(200)
      .json({ success: true, message: "Statistik updated live!", data: stat });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 ERROR UPDATE STAT:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteStat = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const { id } = req.params;

    const stat = await ImpactStats.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!stat) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Stat not found" });
    }

    if (userRole === "editor" && stat.is_locked) {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message: "Akses Dibatasi. Gagal menghapus karena data sedang terkunci.",
        ticket: stat.lock_ticket,
      });
    }

    //  EDITOR
    if (userRole === "editor") {
      await invalidateOldDrafts(id, "ImpactStats", t);

      await stat.update(
        {
          is_locked: true,
          lock_ticket: "PENDING_SYNC",
        },
        { transaction: t },
      );

      await t.commit();

      // External Handshake
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "ImpactStats",
          targetId: stat.id,
          action: "DELETE",
          payload: { label: stat.label },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.headers["authorization"]?.split(" ")[1],
        });

        await stat.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Permintaan hapus statistik diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
        return res.status(202).json({
          success: true,
          message:
            "Statistik dikunci untuk dihapus, sinkronisasi ERP tertunda.",
          warning: owlError.message,
        });
      }
    }

    // SUPERADMIN
    await invalidateOldDrafts(id, "ImpactStats", t);

    await stat.destroy({ transaction: t });
    await t.commit();

    return res
      .status(200)
      .json({ success: true, message: "Statistik deleted live!" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 ERROR DELETE STAT:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
