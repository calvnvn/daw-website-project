const sequelize = require("../config/database");
const BusinessSection = require("../models/BusinessSection");
const BusinessMapMarker = require("../models/BusinessMapMarker");
const Project = require("../models/Project");
const MapCategory = require("../models/MapCategory");
const ApprovalDraft = require("../models/ApprovalDraft");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");
const sanitizeHtml = require("sanitize-html");
const { Op } = require("sequelize");

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

// Admin Getter with Rejection Radar
exports.getAdminBusinessSections = async (req, res) => {
  try {
    const sections = await BusinessSection.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM ApprovalDrafts AS ad
              WHERE ad.target_id = BusinessSection.id
                AND ad.status = 'Rejected'
                AND ad.module_name = 'BusinessSection'
            )`),
            "has_rejected_count",
          ],
        ],
      },
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

    const result = sections.map((s) => {
      const data = s.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("[GET_ADMIN_BUSINESS_ERROR]:", error);
    res.status(500).json({ message: "Failed to fetch admin business data" });
  }
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
    const actorId = String(req.owl_username || req.karyawanId);

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

    // Lock Guard
    if (section.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Akses Dibatasi. Sektor ini sedang dalam proses peninjauan.",
        ticket: section.lock_ticket,
      });
    }

    const { payload, filesToDelete } = await processBusinessPayload(
      req,
      section,
    );

    // EDITOR: Approval Flow
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans("BusinessSection");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "BusinessSection",
          action: "UPDATE",
          target_id: String(id),
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await section.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();
      return res.status(202).json({
        message:
          "Revisi Sektor & Peta diajukan. Data dikunci menunggu persetujuan.",
        ticket: notrans,
      });
    }

    // ADMIN: Direct Commit (Atomic Baton Pass)
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
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

    const timestampId = Date.now().toString(36);
    const generatedId = `${slugify(category).substring(0, 20)}-${timestampId}`;

    const existing = await BusinessSection.findByPk(generatedId, {
      transaction: t,
    });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: "Sektor bisnis sudah ada!" });
    }

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

    // EDITOR: Approval Flow
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans("BusinessSection");

      // Buat baris baru di Live Database TAPI LANGSUNG DIGEMBOK
      await BusinessSection.create(
        { ...sectionPayload, is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      // Simpan konten aslinya ke dalam Vault
      await ApprovalDraft.create(
        {
          notrans,
          module_name: "BusinessSection",
          action: "CREATE",
          target_id: String(generatedId),
          payload: { category, title, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();
      return res.status(202).json({
        message:
          "Pembuatan sektor diajukan. Sektor terkunci menunggu persetujuan.",
        ticket: notrans,
      });
    }

    // ADMIN: Direct Commit
    const newSection = await BusinessSection.create(sectionPayload, {
      transaction: t,
    });
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
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

    const section = await BusinessSection.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!section) {
      await t.rollback();
      return res.status(404).json({ message: "Sektor tidak ditemukan" });
    }

    if (section.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Sektor ini sedang dikunci oleh antrean approval.",
        ticket: section.lock_ticket,
      });
    }

    const attachedProjectsCount = await Project.count({
      where: { category: id },
      transaction: t,
    });
    if (attachedProjectsCount > 0) {
      await t.rollback();
      return res.status(400).json({
        message: `Hapus ditolak! Sektor ini masih memiliki ${attachedProjectsCount} proyek aktif. Pindahkan proyek terlebih dahulu.`,
      });
    }

    let filesToDelete = [];
    if (section.htmlContent) {
      const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
      let match;
      while ((match = imgRegex.exec(section.htmlContent)) !== null) {
        filesToDelete.push(match[1]);
      }
    }

    // EDITOR
    if (userRole === "editor") {
      const notrans = await generateNotrans("BusinessSection");

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "BusinessSection",
          action: "DELETE",
          target_id: String(id),
          payload: { title: section.title, reason: "Request Delete" }, // Payload minimal
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await section.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();
      return res.status(202).json({
        message: "Permintaan hapus sektor dikirim ke Server. Data dikunci.",
        ticket: notrans,
      });
    }

    // ADMIN (Direct Cascade Commit)
    await invalidateOldDrafts("BusinessSection", id, t);
    await BusinessMapMarker.destroy({
      where: { sectionId: id },
      transaction: t,
    });
    await section.destroy({ transaction: t });

    await t.commit();

    if (filesToDelete.length > 0) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
    }

    return res
      .status(200)
      .json({ message: "Sektor berhasil dihapus secara permanen." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [DELETE_SECTION_ERROR]:", error.message);
    res
      .status(500)
      .json({ message: "Gagal memproses penghapusan", error: error.message });
  }
};
