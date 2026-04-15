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
  // 1. Allow all standard editorial tags including tables
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

  // 2. Allow specific styling attributes (used by ReactQuill)
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    "*": ["style", "class"], // Allows Tailwind classes and Quill inline styles
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    // 🔥 CRITICAL: Allow iframes ONLY for YouTube
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
exports.updateBusinessSection = async (req, res) => {
  const { id } = req.params;
  const { title, htmlContent, hasMap, mapMarkers } = req.body;

  // Normalize boolean/tinyint for database compatibility
  const isMapActive =
    hasMap === true || hasMap === "true" || hasMap === 1 ? 1 : 0;

  //Clean the incoming HTML
  const cleanHtmlContent = htmlContent
    ? sanitizeHtml(htmlContent, sanitizeOptions)
    : "";

  // Gatekeeper: Editor Flow
  if (req.userRole && req.userRole.toLowerCase() === "editor") {
    const packageContent = {
      title,
      htmlContent: cleanHtmlContent,
      hasMap: isMapActive,
      mapMarkers: mapMarkers || [], // Kirim seluruh array marker baru
    };

    const tokenOWL = req.owl_token;

    await ErpApprovalService.createDraft(
      {
        jenisApproval: JENIS_APP_CMS,
        karyawanid: req.userId,
        module: "BusinessSection",
        action: "UPDATE_WITH_MARKERS",
        targetId: id,
        content: packageContent,
      },
      tokenOWL,
    );

    return res.status(202).json({
      message: "Draf revisi Sektor Bisnis & Marker berhasil dikirim ke Admin.",
    });
  }

  // Superadmin Flow (Transaction)
  // Initialize a Database Transaction to ensure atomicity (all or nothing)
  const t = await sequelize.transaction();
  try {
    const section = await BusinessSection.findByPk(id);
    if (!section) {
      await t.rollback();
      return res.status(404).json({ message: "Business Section not found!" });
    }

    // Update primary section attributes
    await section.update(
      {
        title: title,
        htmlContent: cleanHtmlContent,
        hasMap: isMapActive,
      },
      { transaction: t },
    );

    /**
     * MARKER SYNCHRONIZATION LOGIC: "Wipe and Replace" Strategy
     * 1. Remove all existing markers associated with this section
     * 2. Re-insert the new set of markers provided by the client
     */
    await BusinessMapMarker.destroy({
      where: { sectionId: id },
      transaction: t,
    });

    // Jika Admin menyalakan toggle Map dan mengirimkan data marker baru
    if (hasMap && mapMarkers && mapMarkers.length > 0) {
      const newMarkers = mapMarkers.map((marker) => ({
        title: marker.title,
        desc: marker.desc,
        categoryId: marker.categoryId || marker.type,
        dotX: marker.dotX,
        dotY: marker.dotY,
        boxX: marker.boxX,
        boxY: marker.boxY,
        mapUrl: marker.mapUrl,
        sectionId: id,
      }));

      await BusinessMapMarker.bulkCreate(newMarkers, { transaction: t });
    }

    // Persist all changes to the database
    await t.commit();
    res.status(200).json({ message: "Business Section updated successfully!" });
  } catch (error) {
    // Revert all changes if any step fails
    await t.rollback();
    console.error("Error updating business section:", error);
    res.status(500).json({
      message: "Failed to update business section",
      error: error.message,
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

/**
 * @desc    Create a new business section with auto-generated ID and ordering
 * @route   POST /api/businesses/admin
 * @access  Private (Admin)
 */
exports.createBusinessSection = async (req, res) => {
  try {
    const { category, title, status } = req.body;
    const generatedId = slugify(category);

    // 1. CEK DUPLIKASI (Di Tabel Utama)
    const existing = await BusinessSection.findByPk(generatedId);
    if (existing) {
      return res.status(400).json({ message: "Sektor bisnis dengan kategori ini sudah ada!" });
    }

    // 2. CEK DUPLIKASI (Di Tabel Antrean/Draft) - Biar gak ada 2 orang request kategori sama
    const pendingDraft = await ApprovalDraft.findOne({ 
      where: { module_name: 'BusinessSection', target_id: generatedId } 
    });
    if (pendingDraft) {
      return res.status(400).json({ message: "Kategori ini sedang dalam antrean approval orang lain!" });
    }

    // Editor Flow
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.owl_token;
      
      const sectionData = {
        id: generatedId,
        category,
        title,
        htmlContent: "",
        hasMap: false,
      };

      const result = await ErpApprovalService.initiateApproval({
        model: BusinessSection,
        targetId: generatedId, 
        action: "CREATE",
        payload: sectionData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({ message: "Permintaan sektor baru dikirim ke OWL.", ticket: result.notrans });
    }

    // --- JALUR SUPERADMIN: DIRECT CREATE ---
    const t = await sequelize.transaction();
    try {
      const maxOrder = (await BusinessSection.max("orderIndex", { transaction: t })) || 0;
      
      const newSection = await BusinessSection.create({
        id: generatedId,
        category,
        title,
        htmlContent: "",
        hasMap: false,
        orderIndex: maxOrder + 1,
      }, { transaction: t });

      await t.commit();
      res.status(201).json(newSection);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


exports.deleteSection = async (req, res) => {
  const { id } = req.params;

  try {
    const section = await BusinessSection.findByPk(id);
    if (!section) return res.status(404).json({ message: "Sektor tidak ditemukan" });

    const attachedProjectsCount = await Project.count({ where: { category: id } });
    if (attachedProjectsCount > 0) {
      return res.status(400).json({
        message: `Hapus ditolak! Sektor ini masih punya ${attachedProjectsCount} proyek aktif.`,
      });
    }

    // Editor Flow
    if (req.userRole?.toLowerCase() === "editor") {
      const tokenOWL = req.owl_token;
      
      const result = await ErpApprovalService.initiateApproval({
        model: BusinessSection,
        targetId: id,
        action: "DELETE",
        payload: { title: section.title }, // Payload tipis aja buat info
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({ 
        message: "Permintaan hapus dikirim ke OWL. Data sekarang dikunci.", 
        ticket: result.notrans 
      });
    }

    // Superadmin Flow
    const t = await sequelize.transaction();
    try {
      // Hapus marker dulu (Foreign Key Safety)
      await BusinessMapMarker.destroy({ where: { sectionId: id }, transaction: t });
      // Hapus sektornya
      await section.destroy({ transaction: t });

      await t.commit();
      res.status(200).json({ message: "Sektor dan marker berhasil dihapus permanen." });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};