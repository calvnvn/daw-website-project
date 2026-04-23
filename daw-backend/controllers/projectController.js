const Project = require("../models/Project");
const BusinessSection = require("../models/BusinessSection");
const { deleteSingleFile } = require("../utils/fileRemover");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ErpApprovalService } = require("../services/erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// ============================================================================
// 🛠️ HELPER FUNCTIONS (Clean Code Architecture)
// ============================================================================

const generateUniqueProjectSlug = async (title, id = null) => {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  let finalSlug = baseSlug;
  let counter = 1;

  while (true) {
    const whereClause = id
      ? { slug: finalSlug, id: { [Op.ne]: id } }
      : { slug: finalSlug };
    const existing = await Project.findOne({ where: whereClause });
    if (!existing) break;
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  return finalSlug;
};

// Ekstraksi logika pemrosesan gambar dan payload agar Controller utama bersih
const processProjectPayload = async (req, project) => {
  const {
    title,
    slug,
    excerpt,
    content,
    category,
    status,
    existing_gallery,
    seo_title,
    meta_description,
  } = req.body;

  let finalGallery = [];
  let filesToDelete = [];
  let coverImageName = project.cover_image;
  let oldCoverToDelete = null;

  // 1. Process Gallery
  if (existing_gallery) {
    try {
      const remainingGallery =
        typeof existing_gallery === "string"
          ? JSON.parse(existing_gallery)
          : existing_gallery;
      const oldGallery =
        typeof project.gallery === "string"
          ? JSON.parse(project.gallery || "[]")
          : project.gallery;
      filesToDelete = oldGallery.filter(
        (file) => !remainingGallery.includes(file),
      );
      finalGallery = remainingGallery;
    } catch (e) {
      console.error("Gagal parse gallery lama:", e);
    }
  }

  if (req.files && req.files["gallery"]) {
    const newImages = req.files["gallery"].map((file) => file.filename);
    finalGallery = [...finalGallery, ...newImages];
  }

  // 2. Process Cover
  if (req.files && req.files["cover_image"]) {
    oldCoverToDelete = project.cover_image;
    coverImageName = req.files["cover_image"][0].filename;
  }

  // 3. Process Slug
  let finalSlug = project.slug;
  if (slug && slug !== project.slug) {
    finalSlug = await generateUniqueProjectSlug(slug, project.id);
  } else if (title && title !== project.title) {
    finalSlug = await generateUniqueProjectSlug(title, project.id);
  }

  return {
    payload: {
      title: title || project.title,
      slug: finalSlug,
      excerpt: excerpt !== undefined ? excerpt : project.excerpt,
      content: content || project.content,
      category: category || project.category,
      status: status || project.status,
      cover_image: coverImageName,
      gallery: finalGallery,
      seo_title: seo_title || project.seo_title,
      meta_description: meta_description || project.meta_description,
    },
    filesToDelete,
    oldCoverToDelete,
  };
};

// ============================================================================
// 🚀 MAIN CONTROLLERS
// ============================================================================

exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [
        { model: BusinessSection, as: "sectorData", attributes: ["category"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔥 REFACTORED: Atomic Create
exports.createProject = async (req, res) => {
  const t = await sequelize.transaction(); // Tambahkan transaksi di Create
  try {
    // Asumsi: prepareProjectData sudah ada di file ini atau didefinisikan sebelumnya
    // Jika fungsi ini ada di middleware/helper lain, pastikan sudah di-import.
    // Jika tidak ada, lo bisa ganti dengan req.body sementara (sesuai kodingan lama lo).
    const projectData =
      typeof prepareProjectData === "function"
        ? await prepareProjectData(req)
        : req.body;
    const { previous_notrans, status } = req.body;
    const userRole = req.userRole?.toLowerCase();

    // 1. Buat record di lokal (Status default Draft)
    const newProject = await Project.create(
      { ...projectData, status: "Draft" },
      { transaction: t },
    );

    // 2. Editor Jalur Publish (Approval)
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      // Handshake OWL
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Project",
        model: Project,
        targetId: newProject.id,
        action: "CREATE",
        payload: { ...projectData, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t, // 👈 WAJIB ADA AGAR TIDAK DEADLOCK
      });

      await newProject.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Diajukan. Data dikunci menunggu persetujuan.",
        ticket: result.notrans,
      });
    }

    // 3. Admin atau Editor Save Draft
    if (status === "Published") {
      await newProject.update({ status: "Published" }, { transaction: t });
    }

    await t.commit();
    return res
      .status(201)
      .json({ message: "Proyek berhasil disimpan.", data: newProject });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 Error CREATE Project:", error);
    res
      .status(500)
      .json({ message: "Gagal memproses permintaan.", error: error.message });
  }
};

// 🔥 REFACTORED: Atomic Update
exports.updateProject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const { status, previous_notrans } = req.body;

    const project = await Project.findByPk(id, { transaction: t });
    if (!project) {
      await t.rollback();
      return res.status(404).json({ message: "Project not found" });
    }

    // 🛡️ THE GATEKEEPER
    if (project.is_locked) {
      if (userRole === "editor") {
        await t.rollback();
        return res.status(423).json({
          message: "Data sedang dikunci oleh proses approval OWL.",
          ticket: project.lock_ticket,
        });
      }
      console.log(`>>> [OVERRIDE] Admin bypass lock pada Proyek ID: ${id}`);
    }

    // 📦 Ekstrak logika berantakan ke helper
    const { payload, filesToDelete, oldCoverToDelete } =
      await processProjectPayload(req, project);

    // --- JALUR EDITOR (Approval) ---
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await project.update({ is_locked: true }, { transaction: t });

      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Project",
        model: Project,
        targetId: id,
        action: "UPDATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
        transaction: t,
      });

      await project.update({ lock_ticket: result.notrans }, { transaction: t });

      await t.commit();
      return res.status(202).json({
        message: "Revisi diajukan. Data asli dikunci.",
        ticket: result.notrans,
      });
    }

    // --- JALUR ADMIN / DRAFT ---
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts("Project", id, t);
    }

    await project.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );
    await t.commit();

    // 🗑️ Hapus file fisik HANYA jika DB sudah berhasil di-commit
    if (
      userRole === "superadmin" ||
      (userRole === "editor" && status === "Draft")
    ) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
      if (oldCoverToDelete) deleteSingleFile(oldCoverToDelete);
    }

    res.status(200).json({
      message: status === "Draft" ? "Draf disimpan." : "Override sukses.",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 ERROR UPDATE PROJECT:", error);
    res.status(500).json({ message: error.message });
  }
};

// 🔥 REFACTORED: Atomic Delete
exports.deleteProject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const project = await Project.findByPk(id, { transaction: t });

    if (!project) {
      await t.rollback();
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Data terkunci karena sedang dalam proses approval.",
        ticket: project.lock_ticket,
      });
    }

    if (userRole === "editor") {
      await project.update({ is_locked: true }, { transaction: t });

      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Project",
        model: Project,
        targetId: id,
        action: "DELETE",
        payload: { title: project.title, reason: "Request Delete" },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
        transaction: t, // 👈 WAJIB ADA
      });

      await project.update({ lock_ticket: result.notrans }, { transaction: t });

      await t.commit();
      return res
        .status(202)
        .json({ message: "Permintaan hapus dikirim.", ticket: result.notrans });
    }

    // --- JALUR ADMIN ---
    await invalidateOldDrafts("Project", id, t);
    await project.destroy({ transaction: t });
    await t.commit();

    // Cleanup File Fisik
    if (project.cover_image) deleteSingleFile(project.cover_image);
    const gallery =
      typeof project.gallery === "string"
        ? JSON.parse(project.gallery || "[]")
        : project.gallery;
    if (Array.isArray(gallery))
      gallery.forEach((file) => deleteSingleFile(file));

    res.status(200).json({ message: "Deleted permanently" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// PUBLIC CONTROLLERS (Tidak pakai transaksi karena cuma READ)
exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No image file provided." });
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res
      .status(200)
      .json({ message: "Image uploaded succesfully", url: fileUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPublicProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      where: { status: "Published" },
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch public projects.",
      error: error.message,
    });
  }
};

exports.getPublicProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, status: "Published" },
    });
    if (!project)
      return res
        .status(404)
        .json({ message: "Project not found or not published" });
    await project.increment("views", { by: 1 });
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPublicProjectBySlug = async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { slug: req.params.slug, status: "Published" },
    });
    if (!project)
      return res
        .status(404)
        .json({ message: "Project not found or not published" });
    await project.increment("views", { by: 1 });
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.incrementProjectView = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (project) await project.increment("views", { by: 1 });
    res.status(200).json({ message: "View incremented" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
