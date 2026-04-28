const fs = require("fs");
const path = require("path");
const HeroSlides = require("../models/HeroSlides");
const HomeSettings = require("../models/HomeSettings");
const ImpactStats = require("../models/ImpactStats");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");
const ErpApprovalService = require("../services/erpApprovalService");
const sequelize = require("../config/database");
const { Op } = require("sequelize");

const MODULE_NAME = "HomeSettings";
const NOTRANS_PREFIX = "HOME";

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

    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();

    console.log(`🕵️ [RADAR SCAN] Searching rejections for: "${actorId}"`);

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

      // 🚀 FIX 3 Robust Query (Case-Insensitive & Collation Safe)
      ApprovalDraft.findAll({
        where: {
          module_name: [
            "HeroSlides",
            "HeroSlide",
            "ImpactStats",
            "HomeSettings",
          ],
          status: "Rejected",
          [Op.and]: [
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("created_by")),
              actorId,
            ),
          ],
        },
      }),
    ]);

    const slides = results[0].status === "fulfilled" ? results[0].value : [];
    const stats = results[1].status === "fulfilled" ? results[1].value : [];
    let settings = results[2].status === "fulfilled" ? results[2].value : null;
    const rejections =
      results[3].status === "fulfilled" ? results[3].value : [];

    // Diagnostic Log
    console.log(`📡 [RADAR RESULT] Found ${rejections.length} rejected items.`);

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

exports.updateSettings = async (req, res) => {
  console.log("🔥 [SYSTEM AUDIT] MENJALANKAN LOGIC SELECTIVE PACKING V2.0");
  console.log("🔥 [SYSTEM AUDIT] PREFIX YANG DIGUNAKAN:", NOTRANS_PREFIX);
  const t = await sequelize.transaction();
  try {
    const userRole = String(req.userRole || "").toLowerCase();
    const { introHeadline, introBody, status, previous_notrans } = req.body;

    const safeHeadline = (introHeadline || "").trim();
    const safeBody = (introBody || "").trim();

    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();

    let settings = await HomeSettings.findByPk(1, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!settings) {
      settings = await HomeSettings.create({ id: 1 }, { transaction: t });
    }

    if (userRole === "editor") {
      if (settings.is_locked) {
        await t.rollback();
        return res.status(423).json({
          success: false,
          message: "Data sedang dalam proses peninjauan (Locked).",
          ticket: settings.lock_ticket,
        });
      }

      const notrans = await generateNotrans(NOTRANS_PREFIX);

      const ticketToClear = previous_notrans || settings.lock_ticket;
      if (ticketToClear) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          {
            where: {
              notrans: ticketToClear,
              module_name: MODULE_NAME,
            },
            transaction: t,
          },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          action: "UPDATE",
          target_id: "1",
          payload: {
            introHeadline: safeHeadline,
            introBody: safeBody,
            status: "Published",
          },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await settings.update(
        {
          is_locked: true,
          lock_ticket: notrans,
        },
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
        console.error(
          `🚨 [ERP SYNC FAILED] Ticket ${notrans}:`,
          owlError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Revisi sambutan beranda diajukan ke ERP OWL.",
        ticket: notrans,
      });
    }

    // 1. Invalidate ALL old drafts for this module
    await ApprovalDraft.update(
      { status: "Obsolete" },
      {
        where: {
          module_name: MODULE_NAME,
          status: ["Pending", "Rejected"],
        },
        transaction: t,
      },
    );

    // 2. Update Ledger langsung (Menggunakan variabel yang sudah di-sanitize)
    await settings.update(
      {
        introHeadline: safeHeadline,
        introBody: safeBody,
        is_locked: false,
        lock_ticket: null,
      },
      { transaction: t },
    );

    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Perubahan live berhasil disimpan secara instan!",
    });
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

    if (userRole === "editor" && status === "Published") {
      const actorId = String(req.owl_username || req.karyawanId);
      const notrans = await generateNotrans("HERO");

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "HeroSlides",
          action: "CREATE",
          target_id: "0",
          payload: { ...slideData, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      slideData.is_locked = true;
      slideData.lock_ticket = notrans;
    }

    newSlide = await HeroSlides.create(slideData, { transaction: t });

    if (userRole === "editor" && status === "Published") {
      await ApprovalDraft.update(
        { target_id: String(newSlide.id) },
        { where: { notrans: slideData.lock_ticket }, transaction: t },
      );
    }

    await t.commit();

    // EXTERNAL HANDSHAKE
    if (userRole === "editor" && status === "Published") {
      try {
        await ErpApprovalService.initiateApproval({
          notrans: slideData.lock_ticket,
          moduleName: "HeroSlides",
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (erpErr) {
        console.error("⚠️ [ERP_SYNC_WARNING]:", erpErr.message);
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan slide baru diajukan.",
        ticket: slideData.lock_ticket,
      });
    }

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
      const actorId = String(req.owl_username || req.karyawanId);
      const notrans = await generateNotrans("HERO");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "HeroSlides",
          action: "UPDATE",
          target_id: String(id),
          payload: { ...updatedData, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      // 3. Lockng
      await slide.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: "HeroSlides",
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
      }

      return res.status(202).json({
        success: true,
        message: "Revisi slide berhasil diajukan ke ERP OWL.",
        ticket: notrans,
      });
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
      const actorId = String(req.owl_username || req.karyawanId);
      const notrans = await generateNotrans("HERO_DEL");
      const fullSnapshot = slide.get({ plain: true });

      const ticketToClear = req.body?.previous_notrans;

      if (ticketToClear) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: ticketToClear }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "HeroSlides",
          action: "DELETE",
          target_id: String(id),
          payload: { ...fullSnapshot, reason: "Request Delete" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await slide.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: "HeroSlides",
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus slide diajukan. Data dikunci sementara.",
        ticket: notrans,
      });
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

    if (userRole === "editor" && status === "Published") {
      const actorId = String(req.owl_username || req.karyawanId);
      const notrans = await generateNotrans("STAT");

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "ImpactStats",
          action: "CREATE",
          target_id: "0",
          payload: { ...statData, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      statData.is_locked = true;
      statData.lock_ticket = notrans;
    }

    newStat = await ImpactStats.create(statData, { transaction: t });

    if (userRole === "editor" && status === "Published") {
      await ApprovalDraft.update(
        { target_id: String(newStat.id) },
        { where: { notrans: statData.lock_ticket }, transaction: t },
      );
    }

    await t.commit();

    // EXTERNAL HANDSHAKE
    if (userRole === "editor" && status === "Published") {
      try {
        await ErpApprovalService.initiateApproval({
          notrans: statData.lock_ticket,
          moduleName: "ImpactStats",
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (erpErr) {
        console.error("⚠️ [ERP_SYNC_WARNING]:", erpErr.message);
      }
      return res.status(202).json({
        success: true,
        message: "Permintaan statistik diajukan.",
        ticket: statData.lock_ticket,
      });
    }

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
      const actorId = String(req.owl_username || req.karyawanId);
      const notrans = await generateNotrans("STAT");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "ImpactStats",
          action: "UPDATE",
          target_id: String(id),
          payload: { ...updatedData, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await stat.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );
      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: "ImpactStats",
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (erpErr) {
        console.error("🚨 [ERP_SYNC_FAILED]:", erpErr.message);
      }

      return res.status(202).json({
        success: true,
        message: "Revisi statistik diajukan.",
        ticket: notrans,
      });
    }

    // SUPERADMIN PATH (Direct Override)
    await invalidateOldDrafts("ImpactStats", String(id), t);
    await stat.update(
      { ...updatedData, is_locked: false, lock_ticket: null },
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
      const actorId = String(req.owl_username || req.karyawanId);
      const notrans = await generateNotrans("STAT_DEL");
      const fullSnapshot = stat.get({ plain: true });

      // 1. Simpan niat penghapusan ke Vault
      await ApprovalDraft.create(
        {
          notrans,
          module_name: "ImpactStats",
          action: "DELETE",
          target_id: String(id),
          payload: { ...fullSnapshot, reason: "Request Delete" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      // 2. Pasang Gembok Hapus
      await stat.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await t.commit();

      // 3. External Handshake
      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: "ImpactStats",
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (erpError) {
        console.error("🚨 [ERP SYNC FAILED]:", erpError.message);
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus statistik diajukan. Data dikunci sementara.",
        ticket: notrans,
      });
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
