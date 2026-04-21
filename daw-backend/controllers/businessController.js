const BusinessSection = require("../models/BusinessSection");
const BusinessMapMarker = require("../models/BusinessMapMarker");
const Project = require("../models/Project");
const MapCategory = require("../models/MapCategory");
const sequelize = require("../config/database");
const sanitizeHtml = require("sanitize-html");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { deleteSingleFile } = require("../utils/fileRemover");

const ErpApprovalService = require("../services/erpApprovalService");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

/**
 * @constant sanitizeOptions
 * Defines the strict rules for HTML content allowed from the WYSIWYG Editor.
 * Custom-built to support rich typography, tables, and YouTube embeds.
 */
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

/**
 * @desc    Utility function to generate URL-friendly slugs
 * @example "Renewable Energy" -> "renewable-energy"
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .trim(); // Trim whitespace
};

/**
 * @desc    Fetch all business sections for the public-facing website
 * @route   GET /api/businesses/public
 * @access  Public
 */
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

/**
 * @desc    Update an existing business section and synchronize its map markers
 * @route   PUT /api/businesses/admin/:id
 * @access  Private (Admin/Editor)
 */
exports.updateBusinessSection = async (req, res) => {
  const { id } = req.params;
  const { title, htmlContent, hasMap, mapMarkers, previous_notrans } = req.body;
  const userRole = req.userRole?.toLowerCase();

  try {
    const section = await BusinessSection.findByPk(id);
    if (!section)
      return res
        .status(404)
        .json({ message: "Sektor Bisnis tidak ditemukan!" });

    // 🔒 THE GATEKEEPER (Blueprint 1.1)
    if (section.is_locked && userRole === "editor") {
      return res.status(423).json({
        success: false,
        message: "Akses Dibatasi. Sektor ini sedang dalam proses peninjauan.",
        ticket: section.lock_ticket,
      });
    }

    const isMapActive = [true, "true", 1, "1"].includes(hasMap) ? 1 : 0;
    const cleanHtmlContent = htmlContent
      ? sanitizeHtml(htmlContent, sanitizeOptions)
      : "";

    const packageContent = {
      title: title || section.title,
      htmlContent: cleanHtmlContent,
      hasMap: isMapActive,
      mapMarkers: mapMarkers || [],
    };

    // --- JALUR EDITOR ---
    if (userRole === "editor") {
      // CLEANUP: Resubmission Check
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      // External Handshake
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: BusinessSection,
          targetId: id,
          action: "UPDATE",
          payload: packageContent,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        // Kunci Data Lokal
        await section.update({ is_locked: true, lock_ticket: result.notrans });

        return res.status(202).json({
          message:
            "Revisi (Artikel & Peta) telah diajukan. Sektor berhasil dikunci.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        throw owlError;
      }
    }

    // --- JALUR SUPERADMIN (DIRECT OVERRIDE) ---
    const t = await sequelize.transaction();
    try {
      console.log(
        `>>> [BUSINESS] SUPERADMIN OVERRIDE: Editing Section ID ${id}`,
      );

      // 1. Bunuh draf lama (Atomic Draft Killer)
      await invalidateOldDrafts("BusinessSection", id, t);

      // 2. Physical File Cleanup Logic
      // Mencari gambar lama di HTML untuk dihapus jika tidak ada di HTML baru
      if (section.htmlContent) {
        const oldImages = [];
        const newImages = [];
        const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
        let match;

        while ((match = imgRegex.exec(section.htmlContent)) !== null)
          oldImages.push(match[1]);
        while ((match = imgRegex.exec(cleanHtmlContent)) !== null)
          newImages.push(match[1]);

        const imagesToDelete = oldImages.filter(
          (img) => !newImages.includes(img),
        );
        imagesToDelete.forEach((img) => deleteSingleFile(img)); // Hapus gambar fisik lama
      }

      // 3. Update Text Content & Unlock
      await section.update(
        {
          title,
          htmlContent: cleanHtmlContent,
          hasMap: isMapActive,
          is_locked: false,
          lock_ticket: null,
        },
        { transaction: t },
      );

      // 4. Sinkronisasi Map Markers
      await BusinessMapMarker.destroy({
        where: { sectionId: id },
        transaction: t,
      });

      if (isMapActive && mapMarkers && mapMarkers.length > 0) {
        const newMarkers = mapMarkers.map((marker) => ({
          ...marker,
          categoryId: marker.categoryId || marker.type,
          sectionId: id,
        }));
        await BusinessMapMarker.bulkCreate(newMarkers, { transaction: t });
      }

      await t.commit();
      return res.status(200).json({
        message: "Sektor dan lokasi peta berhasil diperbarui secara permanen!",
      });
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }
  } catch (error) {
    console.error("🚨 [CONTROLLER ERROR]:", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
      error: true,
    });
  }
};

exports.createBusinessSection = async (req, res) => {
  const { category, title } = req.body;
  const generatedId = slugify(category);
  const userRole = req.userRole?.toLowerCase();

  try {
    const existing = await BusinessSection.findByPk(generatedId);
    if (existing) {
      return res.status(400).json({ message: "Sektor bisnis sudah ada!" });
    }

    const maxOrder = (await BusinessSection.max("orderIndex")) || 0;

    const sectionPayload = {
      id: generatedId,
      category,
      title,
      htmlContent: "",
      hasMap: false,
      orderIndex: maxOrder + 1,
      is_locked: false, // Default
      lock_ticket: null,
    };

    // --- JALUR EDITOR ---
    if (userRole === "editor") {
      // Phase 1: Local DB (Simpan sebagai Draft Terkunci)
      sectionPayload.is_locked = true;
      const newSection = await BusinessSection.create(sectionPayload);

      try {
        // Phase 2: Network Call (OWL)
        const result = await ErpApprovalService.initiateApproval({
          model: BusinessSection,
          targetId: generatedId,
          action: "CREATE",
          payload: { category, title },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        // Kunci Data Lokal
        await newSection.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          message:
            "Pembuatan sektor diajukan. Sektor terkunci menunggu persetujuan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        // Blueprint: Jika gagal, hancurkan record "Yatim Piatu"
        console.error(
          `>>> [CLEANUP] Menghapus orphan section ID: ${generatedId}`,
        );
        await newSection.destroy();
        throw owlError; // Lemparkan ke catch utama
      }
    }

    // --- JALUR SUPERADMIN ---
    const newSection = await BusinessSection.create(sectionPayload);
    console.log(`>>> [BUSINESS] SECTOR CREATED INSTANTLY: ${generatedId} <<<`);
    return res.status(201).json({
      message: "Sektor bisnis baru berhasil dibuat secara langsung.",
      data: newSection,
    });
  } catch (error) {
    console.error("🚨 [CREATE_SECTION_ERROR]:", error.message);
    return res.status(500).json({
      message: "Gagal memproses pembuatan sektor.",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete Section
 * @route   DELETE /api/businesses/admin/:id
 * @access  Private (Admin/Editor)
 */
exports.deleteSection = async (req, res) => {
  const { id } = req.params;
  const userRole = req.userRole?.toLowerCase();

  try {
    const section = await BusinessSection.findByPk(id);
    if (!section)
      return res.status(404).json({ message: "Sektor tidak ditemukan" });

    // 🔒 THE GATEKEEPER
    if (section.is_locked && userRole === "editor") {
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Sektor ini sedang dikunci oleh antrean approval.",
        ticket: section.lock_ticket,
      });
    }

    const attachedProjectsCount = await Project.count({
      where: { category: id },
    });
    if (attachedProjectsCount > 0) {
      return res.status(400).json({
        message: `Hapus ditolak! Sektor ini masih memiliki ${attachedProjectsCount} proyek aktif.`,
      });
    }

    // --- JALUR EDITOR ---
    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: BusinessSection,
        targetId: id,
        action: "DELETE",
        payload: { title: section.title },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      await section.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Permintaan hapus sektor dikirim. Data dikunci.",
        ticket: result.notrans,
      });
    }

    // --- JALUR SUPERADMIN ---
    const t = await sequelize.transaction();
    try {
      // 1. Bunuh draf lama (Atomic Draft Killer)
      await invalidateOldDrafts("BusinessSection", id, t);

      await section.reload({ transaction: t, lock: t.LOCK.UPDATE });

      // 2. Physical HTML File Cleanup
      if (section.htmlContent) {
        const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
        let match;
        while ((match = imgRegex.exec(section.htmlContent)) !== null) {
          deleteSingleFile(match[1]); // Hapus semua gambar fisik di HTML
        }
      }

      await BusinessMapMarker.destroy({
        where: { sectionId: id },
        transaction: t,
      });
      await section.destroy({ transaction: t });

      await t.commit();
      return res
        .status(200)
        .json({ message: "Sektor berhasil dihapus secara permanen." });
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }
  } catch (error) {
    console.error("🚨 [DELETE_SECTION_ERROR]:", error.message);
    res.status(error.statusCode || 500).json({
      message: error.message || "Gagal memproses penghapusan",
    });
  }
};
