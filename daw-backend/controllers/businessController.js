const BusinessSection = require("../models/BusinessSection");
const BusinessMapMarker = require("../models/BusinessMapMarker");
const Project = require("../models/Project");
const MapCategory = require("../models/MapCategory");
const sequelize = require("../config/database");
const sanitizeHtml = require("sanitize-html");

const ErpApprovalService = require("../services/erpApprovalService");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE || "040101";

/**
 * @constant sanitizeOptions
 * Defines the strict rules for HTML content allowed from the WYSIWYG Editor.
 * Custom-built to support rich typography, tables, and YouTube embeds.
 */
const sanitizeOptions = {
  // Allow all standard editorial tags including tables
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
 * @desc    Fetch all business sections for the public-facing website
 * @route   GET /api/businesses/public
 * @access  Public
 */
exports.getPublicBusinessData = async (req, res) => {
  try {
    const sections = await BusinessSection.findAll({
      // Eager load nested associations: Section -> Markers -> Category Details
      attributes: [
        "id",
        "category",
        "title",
        "htmlContent",
        "hasMap",
        "orderIndex",
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
      // Maintain sequence based on creation time or orderIndex
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
 * @access  Private (Admin)
 */
/**
 * @desc    Update an existing business section and synchronize its map markers
 * @route   PUT /api/businesses/admin/:id
 * @access  Private (Admin/Editor)
 */
exports.updateBusinessSection = async (req, res) => {
  const { id } = req.params;
  const { title, htmlContent, hasMap, mapMarkers } = req.body;
  const isMapActive =
    hasMap === true || hasMap === "true" || hasMap === 1 ? 1 : 0;
  const cleanHtmlContent = htmlContent
    ? sanitizeHtml(htmlContent, sanitizeOptions)
    : "";

  const t = await sequelize.transaction();

  try {
    const section = await BusinessSection.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!section) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "Sektor Bisnis tidak ditemukan!" });
    }

    // --- JALUR 1: BYPASS (MARKERS & MAP TOGGLE) ---
    // Editor maupun Admin, update marker dan toggle map LANGSUNG ke database utama
    await section.update({ hasMap: isMapActive }, { transaction: t });

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

    // --- JALUR 2: SELECTIVE APPROVAL (TITLE & HTML CONTENT) ---
    if (req.userRole && req.userRole.toLowerCase() === "editor") {
      // Bandingkan apakah Konten Artikel (Title/HTML) berubah?
      const isContentChanged =
        section.title !== title || section.htmlContent !== cleanHtmlContent;

      if (isContentChanged) {
        // Cek gembok HANYA jika ingin mengubah konten
        if (section.is_locked) {
          await t.rollback();
          return res.status(423).json({
            message: "Konten artikel sedang dikunci oleh approval lain.",
            ticket: section.lock_ticket,
          });
        }

        const result = await ErpApprovalService.initiateApproval({
          model: BusinessSection,
          targetId: id,
          action: "UPDATE_ARTICLE_ONLY", // Action spesifik untuk update teks saja
          payload: { title, htmlContent: cleanHtmlContent },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
          transaction: t,
        });

        await t.commit();
        return res.status(202).json({
          message:
            "Lokasi peta diperbarui, namun revisi artikel dikirim ke OWL untuk persetujuan.",
          ticket: result.notrans,
        });
      }
    }

    // JALUR SUPERADMIN: Langsung simpan konten artikel
    await section.update(
      { title, htmlContent: cleanHtmlContent },
      { transaction: t },
    );

    await t.commit();
    res
      .status(200)
      .json({ message: "Sektor dan lokasi peta berhasil diperbarui!" });
  } catch (error) {
    if (t) await t.rollback();
    console.error("🚨 [CONTROLLER ERROR]:", error.message);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
      details: error.details || null,
      error: true,
    });
  }
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

exports.createBusinessSection = async (req, res) => {
  const { category, title } = req.body;
  const generatedId = slugify(category);
  const t = await sequelize.transaction();

  try {
    const existing = await BusinessSection.findByPk(generatedId, {
      transaction: t,
    });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: "Sektor bisnis sudah ada!" });
    }

    const maxOrder =
      (await BusinessSection.max("orderIndex", { transaction: t })) || 0;

    const newSection = await BusinessSection.create(
      {
        id: generatedId,
        category,
        title,
        htmlContent: "",
        hasMap: false,
        orderIndex: maxOrder + 1,
        is_locked: false, // Bebas akses
      },
      { transaction: t },
    );

    await t.commit();
    res.status(201).json(newSection);
  } catch (error) {
    if (t) await t.rollback();
    console.error("🚨 [CONTROLLER ERROR]:", error.message);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
      details: error.details || null, // Jika ada detail tambahan
      error: true,
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

  // 1. INISIALISASI ATOMIC TRANSACTION (SOP Point B)
  const t = await sequelize.transaction();

  try {
    // 2. CHECK LOCK (The Gatekeeper) + Pessimistic Lock Database Level
    const section = await BusinessSection.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!section) {
      await t.rollback();
      return res.status(404).json({ message: "Sektor tidak ditemukan" });
    }

    if (section.is_locked) {
      await t.rollback();
      return res.status(423).json({
        message:
          "Sektor ini sedang dikunci oleh antrean approval dan tidak dapat dihapus.",
        ticket: section.lock_ticket,
      });
    }

    // 3. ORPHAN GUARD (SOP Integrity)
    const attachedProjectsCount = await Project.count({
      where: { category: id },
      transaction: t,
    });

    if (attachedProjectsCount > 0) {
      await t.rollback();
      return res.status(400).json({
        message: `Hapus ditolak! Sektor ini masih memiliki ${attachedProjectsCount} proyek aktif. Harap pindahkan atau hapus proyek terkait terlebih dahulu.`,
      });
    }

    // 4. EDITOR GATE
    if (req.userRole?.toLowerCase() === "editor") {
      const tokenOWL = req.owl_token;

      const result = await ErpApprovalService.initiateApproval({
        model: BusinessSection,
        targetId: id,
        action: "DELETE",
        payload: { title: section.title }, // Payload minimal untuk keperluan log di OWL/Approval Center
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL,
        transaction: t, // Inject transaction agar locking lokal & OWL sinkron
      });

      await t.commit();
      return res.status(202).json({
        message:
          "Permintaan hapus sektor bisnis telah dikirim ke OWL. Data sekarang dikunci.",
        ticket: result.notrans,
      });
    }

    // 5. SUPERADMIN FLOW (Direct Hard Delete)
    await BusinessMapMarker.destroy({
      where: { sectionId: id },
      transaction: t,
    });

    // Hapus sektornya
    await section.destroy({ transaction: t });

    await t.commit();
    res.status(200).json({
      message:
        "Sektor bisnis beserta marker lokasinya berhasil dihapus secara permanen.",
    });
  } catch (error) {
    if (t) await t.rollback();
    console.error("🚨 [DELETE_SECTION_ERROR]:", error.message);
    res
      .status(500)
      .json({ message: "Gagal memproses penghapusan", error: error.message });
  }
};
