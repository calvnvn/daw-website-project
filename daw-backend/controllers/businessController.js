const sequelize = require("../config/database");
const BusinessSection = require("../models/BusinessSection");
const BusinessMapMarker = require("../models/BusinessMapMarker");
const Project = require("../models/Project");
const MapCategory = require("../models/MapCategory");
const ApprovalDraft = require("../models/ApprovalDraft");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { deleteSingleFile } = require("../utils/fileRemover");
const { ErpApprovalService } = require("../services/erpApprovalService");
const sanitizeHtml = require("sanitize-html");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

const sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "iframe",
    "u",
    "s",
    "span",
    "br",
  ]),

  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["style", "class"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: [
      "src",
      "width",
      "height",
      "frameborder",
      "allow",
      "allowfullscreen",
      "style",
      "class",
      "title",
    ],
  },

  // 3. The Enforcer: Ensure iframes only point to safe domains
  allowedIframeHostnames: [
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "youtu.be", // Short link
  ],

  allowedSchemes: ["http", "https", "ftp", "mailto", "data"],

  // 4. Prevent injection via inline CSS (e.g., style="background: url(javascript:...)")
  allowedStyles: {
    "*": {
      color: [
        /^#(0x)?[0-9a-f]+$/i,
        /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/,
      ],
      "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
      "background-color": [/^#(0x)?[0-9a-f]+$/i],
      "font-size": [/^\d+(px|em|rem|%)$/],
    },
  },
};

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .trim(); // Trim whitespace
};

const extractImagesFromHtml = (html) => {
  if (!html) return [];
  const images = [];
  const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    images.push(match[1]);
  }
  return images;
};

const processBusinessPayload = async (req, existingData = {}) => {
  const { title, htmlContent, hasMap, mapMarkers } = req.body;
  let filesToDelete = [];

  const cleanHtmlContent = htmlContent
    ? sanitizeHtml(htmlContent, sanitizeOptions)
    : existingData.htmlContent || "";

  if (existingData.htmlContent) {
    const oldImages = extractImagesFromHtml(existingData.htmlContent);
    const newImages = extractImagesFromHtml(cleanHtmlContent);

    filesToDelete = oldImages.filter((img) => !newImages.includes(img));
  }

  const isMapActive = [true, "true", 1, "1"].includes(hasMap) ? 1 : 0;

  const finalMarkers = Array.isArray(mapMarkers)
    ? mapMarkers.map((marker) => ({
        ...marker,
        categoryId: marker.categoryId || marker.type,
      }))
    : [];

  return {
    payload: {
      title: title || existingData.title,
      htmlContent: cleanHtmlContent,
      hasMap: isMapActive,
      mapMarkers: finalMarkers,
    },
    filesToDelete,
  };
};

exports.getPublicBusinessData = async (req, res) => {
  try {
    const sections = await BusinessSection.findAll({
      attributes: [
        "id",
        "category",
        "title",
        "htmlContent",
        "hasMap",
        "orderIndex",
        "is_locked",
        "lock_ticket",
      ],
      include: [
        {
          model: BusinessMapMarker,
          as: "mapMarkers",
          required: false,
          include: [
            {
              model: MapCategory,
              as: "categoryData",
              attributes: ["id", "name", "color"],
            },
          ],
        },
      ],
      order: [["orderIndex", "ASC"]],
    });

    res.status(200).json(sections);
  } catch (error) {
    console.error("Error fetching business data:", error);
    res.status(500).json({ message: "Failed to fetch business data" });
  }
};

exports.updateBusinessSection = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const { status, previous_notrans } = req.body;

    const section = await BusinessSection.findByPk(id, { transaction: t });
    if (!section) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "Sektor Bisnis tidak ditemukan!" });
    }

    // 1. GATEKEEPER: Lock Guard
    if (section.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message:
          "Akses Dibatasi. Sektor ini sedang dalam proses peninjauan ERP.",
        ticket: section.lock_ticket,
      });
    }

    // 2. PEMROSESAN PAYLOAD (HTML Sanitization & Image Extraction)
    const { payload, filesToDelete } = await processBusinessPayload(
      req,
      section,
    );

    // 3. JALUR EDITOR: Approval Flow
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      // Shared Transaction ke ERP
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "BusinessSection",
        model: BusinessSection,
        targetId: id,
        action: "UPDATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      // Kunci data lokal
      await section.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message:
          "Revisi Sektor & Peta diajukan. Data dikunci menunggu persetujuan.",
        ticket: result.notrans,
      });
    }

    // 4. JALUR ADMIN: Direct Commit (Atomic Baton Pass)
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts("BusinessSection", id, t);
    }

    // Update Tabel BusinessSection
    await section.update(
      {
        title: payload.title,
        htmlContent: payload.htmlContent,
        hasMap: payload.hasMap,
        is_locked: false,
        lock_ticket: null,
      },
      { transaction: t },
    );

    // Update TabelBusinessMapMarker
    await BusinessMapMarker.destroy({
      where: { sectionId: id },
      transaction: t,
    });

    if (payload.hasMap && payload.mapMarkers && payload.mapMarkers.length > 0) {
      const newMarkers = payload.mapMarkers.map((marker) => ({
        ...marker,
        sectionId: id,
      }));
      await BusinessMapMarker.bulkCreate(newMarkers, { transaction: t });
    }

    await t.commit();

    if (filesToDelete && filesToDelete.length > 0) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
    }

    return res.status(200).json({
      message: "Sektor dan lokasi peta berhasil diperbarui secara permanen!",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("[UPDATE_BUSINESS_ERROR]:", error.message);
    return res.status(500).json({ message: error.message });
  }
};

exports.createBusinessSection = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { category, title, status } = req.body;
    const generatedId = slugify(category);
    const userRole = req.userRole?.toLowerCase();

    // 1. Validasi Unik di Dalam Transaksi
    const existing = await BusinessSection.findByPk(generatedId, {
      transaction: t,
    });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: "Sektor bisnis sudah ada!" });
    }

    // 2. Hitung Max Order secara Dinamis
    const maxOrder =
      (await BusinessSection.max("orderIndex", { transaction: t })) || 0;

    const sectionPayload = {
      id: generatedId,
      category,
      title,
      htmlContent: "",
      hasMap: false,
      orderIndex: maxOrder + 1,
      is_locked: false,
      lock_ticket: null,
    };

    const newSection = await BusinessSection.create(sectionPayload, {
      transaction: t,
    });

    // 3. JALUR EDITOR: Approval Flow
    if (userRole === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "BusinessSection",
        model: BusinessSection,
        targetId: generatedId,
        action: "CREATE",
        payload: { category, title, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await newSection.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message:
          "Pembuatan sektor diajukan. Sektor terkunci menunggu persetujuan.",
        ticket: result.notrans,
      });
    }

    // 4. JALUR ADMIN: Direct Commit
    await t.commit();
    return res.status(201).json({
      message: "Sektor bisnis baru berhasil dibuat secara langsung.",
      data: newSection,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("[CREATE_BUSINESS_ERROR]:", error.message);
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteSection = async (req, res) => {
  // 1. BUKA GERBANG TRANSAKSI DI AWAL
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();

    // 2. Ambil data dengan EXCLUSIVE LOCK (SELECT ... FOR UPDATE)
    const section = await BusinessSection.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!section) {
      await t.rollback();
      return res.status(404).json({ message: "Sektor tidak ditemukan" });
    }

    // 3. GATEKEEPER: Lock Guard
    if (section.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Sektor ini sedang dikunci oleh antrean approval ERP.",
        ticket: section.lock_ticket,
      });
    }

    // 4. VALIDASI RELASI (Di dalam Transaksi)
    const attachedProjectsCount = await Project.count({
      where: { category: id },
      transaction: t,
    });

    if (attachedProjectsCount > 0) {
      await t.rollback();
      return res.status(400).json({
        message: `Hapus ditolak! Sektor ini masih memiliki ${attachedProjectsCount} proyek aktif.`,
      });
    }

    // 5. SIAPKAN DAFTAR SAMPAH FILE (Kumpulkan sekarang, hapus nanti)
    let filesToDelete = [];
    if (section.htmlContent) {
      const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
      let match;
      while ((match = imgRegex.exec(section.htmlContent)) !== null) {
        filesToDelete.push(match[1]);
      }
    }

    // JALUR 1: EDITOR (Approval Flow)
    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "BusinessSection",
        model: BusinessSection,
        targetId: id,
        action: "DELETE",
        payload: { title: section.title, reason: "Request Delete" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await section.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Permintaan hapus sektor dikirim ke ERP. Data dikunci.",
        ticket: result.notrans,
      });
    }

    // JALUR 2: SUPERADMIN / ADMIN (Direct Cascade Commit)
    await invalidateOldDrafts("BusinessSection", id, t);
    await BusinessMapMarker.destroy({
      where: { sectionId: id },
      transaction: t,
    });
    await section.destroy({ transaction: t });
    await t.commit();

    // 6. PHYSICAL FILE CLEANUP (Sangat Aman)
    if (filesToDelete.length > 0) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
    }

    return res
      .status(200)
      .json({ message: "Sektor berhasil dihapus secara permanen." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [DELETE_SECTION_ERROR]:", error.message);
    res.status(500).json({
      message: "Gagal memproses penghapusan",
      error: error.message,
    });
  }
};
