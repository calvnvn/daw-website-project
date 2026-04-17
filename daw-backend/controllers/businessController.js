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

    if (section.is_locked) {
      return res.status(423).json({
        message: "Sektor ini sedang dikunci oleh proses approval OWL.",
        ticket: section.lock_ticket,
      });
    }

    const isMapActive = [true, "true", 1, "1"].includes(hasMap) ? 1 : 0;
    const cleanHtmlContent = htmlContent
      ? sanitizeHtml(htmlContent, sanitizeOptions)
      : "";

    // EDITOR (APPROVAL REQUIRED)
    if (userRole === "editor") {
      console.log(
        `>>> [BUSINESS] JALUR EDITOR: INITIATING ATOMIC UPDATE FOR ID: ${id} <<<`,
      );

      const packageContent = {
        title: title || section.title,
        htmlContent: cleanHtmlContent,
        hasMap: isMapActive,
        mapMarkers: mapMarkers || [],
      };

      // CLEANUP: Jika ini re-submission, tandai draf lama sebagai Replaced
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      // EXTERNAL HANDSHAKE (Di luar DB Transaction utama)
      const result = await ErpApprovalService.initiateApproval({
        model: BusinessSection,
        targetId: id,
        action: "UPDATE",
        payload: packageContent,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      await section.update({
        is_locked: true,
        lock_ticket: result.notrans,
      });

      return res.status(202).json({
        message:
          "Revisi (Artikel & Peta) telah diajukan ke OWL. Sektor berhasil dikunci.",
        ticket: result.notrans,
      });
    }

    // SUPERADMIN (DIRECT UPDATE)
    console.log(">>> [BUSINESS] JALUR SUPERADMIN: DIRECT COMMIT <<<");

    const t = await sequelize.transaction();
    try {
      await section.update(
        { title, htmlContent: cleanHtmlContent, hasMap: isMapActive },
        { transaction: t },
      );

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
  const userRole = req.userRole?.toLowerCase();
  const generatedId = slugify(category);

  let newSection = null;

  try {
    // DISCOVERY: Cek apakah ID sudah dipakai
    const existing = await BusinessSection.findByPk(generatedId);
    if (existing) {
      return res.status(400).json({ message: "Sektor bisnis sudah ada!" });
    }

    // PRE-INSERT STRATEGY
    const maxOrder = (await BusinessSection.max("orderIndex")) || 0;

    newSection = await BusinessSection.create({
      id: generatedId,
      category,
      title,
      htmlContent: "",
      hasMap: false,
      orderIndex: maxOrder + 1,
      is_locked: false,
    });

    // EDITOR GATE (The Compliance Check)
    if (userRole === "editor") {
      console.log(
        `>>> [BUSINESS] JALUR EDITOR: INITIATING APPROVAL FOR NEW SECTOR: ${generatedId} <<<`,
      );

      try {
        const result = await ErpApprovalService.initiateApproval({
          model: BusinessSection,
          targetId: generatedId, // ID hasil Pre-insert tadi
          action: "CREATE",
          payload: { category, title, status: "Published" },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        // Jika OWL sukses, baru pasang gembok di lokal
        await newSection.update({
          is_locked: true,
          lock_ticket: result.notrans,
        });

        return res.status(202).json({
          message:
            "Permintaan pembuatan sektor bisnis baru dikirim ke OWL. Data dikunci.",
          ticket: result.notrans,
          data: newSection,
        });
      } catch (owlError) {
        // Jika OWL gagal (misal: error 500 atau timeout), kita hapus record draf tadi.
        if (newSection) {
          console.error(
            `>>> [CLEANUP] Deleting orphan section: ${generatedId} due to OWL failure`,
          );
          await newSection.destroy();
        }
        throw owlError;
      }
    }

    // SUPERADMIN
    console.log(">>> [BUSINESS] JALUR SUPERADMIN: DIRECT CREATE SUCCESS <<<");
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
