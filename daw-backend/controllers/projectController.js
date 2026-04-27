const Project = require("../models/Project");
const BusinessSection = require("../models/BusinessSection");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

//Mencari URL gambar di dalam string HTML untuk kebutuhan cleanup
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

// HELPER FUNCTIONS (Clean Code Architecture)
const generateUniqueProjectSlug = async (title, id = null) => {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  let finalSlug = baseSlug;
  let counter = 1;

  while (true) {
    // Check live table
    const whereClause = id
      ? { slug: finalSlug, id: { [Op.ne]: id } }
      : { slug: finalSlug };
    const existingLive = await Project.findOne({ where: whereClause });

    // Cek di dalam Brankas ApprovalDraft supaya tidak collision
    const existingDraft = await ApprovalDraft.findOne({
      where: {
        module_name: "Project",
        status: "Pending",
        "payload.slug": finalSlug,
      },
    });

    if (!existingLive && !existingDraft) break;

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

  const authorIdentity = req.owl_username || req.karyawanId || "System Admin";
  let finalGallery = [];
  let filesToDelete = [];
  let coverImageName = project?.cover_image || null;
  let oldCoverToDelete = null;

  const cleanContent = content || project.content || "";

  if (project.content) {
    const oldHtmlImages = extractImagesFromHtml(project.content);
    const newHtmlImages = extractImagesFromHtml(cleanContent);
    const deletedHtmlImages = oldHtmlImages.filter(
      (img) => !newHtmlImages.includes(img),
    );
    filesToDelete = [...filesToDelete, ...deletedHtmlImages];
  }

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

      const removedFromGallery = oldGallery.filter(
        (file) => !remainingGallery.includes(file),
      );
      filesToDelete = [...filesToDelete, ...removedFromGallery];
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

  const allFilesToTrash = [...filesToDelete];
  if (oldCoverToDelete) allFilesToTrash.push(oldCoverToDelete);

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
      author: project.author || authorIdentity,
      _filesToDelete: allFilesToTrash,
    },
    filesToDelete,
    oldCoverToDelete,
  };
};

exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      attributes: {
        include: [
          // Subquery untuk cek status rejected di Vault
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM ApprovalDrafts AS ad
              WHERE ad.target_id = Project.id
                AND ad.status = 'Rejected'
                AND ad.module_name = 'Project'
            )`),
            "has_rejected_count",
          ],
        ],
      },
      include: [
        { model: BusinessSection, as: "sectorData", attributes: ["category"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Map agar has_rejected jadi boolean yang mudah dibaca Frontend
    const result = projects.map((p) => {
      const data = p.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: BusinessSection, as: "sectorData", attributes: ["category"] },
      ],
    });

    if (!project) return res.status(404).json({ message: "Project not found" });
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { previous_notrans, status: requestStatus } = req.body;
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

    // 1. Bersihkan Payload
    const { payload } = await processProjectPayload(req, {
      title: "",
      slug: "",
      gallery: [],
      cover_image: null,
    });

    // EDITOR: Ajukan Publish (Approval ERP)
    if (userRole === "editor" && requestStatus === "Published") {
      // Dapatkan Kunci Antrean
      const notrans = await generateNotrans("Projects");

      // Invalidate Draf Lama (Jika ada resubmission)
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      // Buat Data Asli (Langsung Digembok)
      const newProject = await Project.create(
        { ...payload, status: "Draft", is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Project",
          action: "CREATE",
          target_id: String(newProject.id),
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      // e. THE HANDSHAKE: Lapor ke ERP
      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();
      return res.status(202).json({
        message: "Proyek baru diajukan. Data dikunci menunggu persetujuan.",
        ticket: notrans,
      });
    }

    // ADMIN: LIVE OR LOCAL DRAFT (Editor Save as Draft)
    const finalStatus = requestStatus === "Published" ? "Published" : "Draft";
    const newProject = await Project.create(
      { ...payload, status: finalStatus, is_locked: false },
      { transaction: t },
    );

    await t.commit();
    return res.status(201).json({
      message:
        finalStatus === "Draft"
          ? "Draf proyek berhasil disimpan lokal."
          : "Proyek berhasil dipublikasikan.",
      data: newProject,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 Error CREATE Project:", error);
    res
      .status(500)
      .json({ message: "Gagal membuat proyek baru.", error: error.message });
  }
};

exports.updateProject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const { status, previous_notrans } = req.body;
    const actorId = String(req.owl_username || req.karyawanId);

    const project = await Project.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!project) {
      await t.rollback();
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.is_locked) {
      if (userRole === "editor") {
        await t.rollback();
        return res.status(423).json({
          message: "Data sedang dikunci oleh proses approval.",
          ticket: project.lock_ticket,
        });
      }
      console.log(`>>> [OVERRIDE] Admin bypass lock pada Proyek ID: ${id}`);
    }

    const { payload, filesToDelete, oldCoverToDelete } =
      await processProjectPayload(req, project);

    // EDITOR: Ajukan Revisi
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans("Projects");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Project",
          action: "UPDATE",
          target_id: String(id),
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      // Pasang Gembok di Live Data
      await project.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      // Handshake
      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();
      return res.status(202).json({
        message: "Revisi diajukan. Data asli dikunci.",
        ticket: notrans,
      });
    }

    // ADMIN / DRAFT LOKAL
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts("Project", id, t);
    }

    await project.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );
    await t.commit();

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

exports.deleteProject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

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

    // EDITOR: Ajukan Penghapusan
    if (userRole === "editor") {
      const notrans = await generateNotrans("Projects");

      // Bikin draf "Minta Hapus"
      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Project",
          action: "DELETE",
          target_id: String(id),
          payload: { title: project.title, reason: "Request Delete" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      // Gembok doang, JANGAN DI-DESTROY!
      await project.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();
      return res
        .status(202)
        .json({ message: "Permintaan hapus dikirim.", ticket: notrans });
    }

    // ADMIN
    await invalidateOldDrafts("Project", id, t);
    await project.destroy({ transaction: t });
    await t.commit();

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

    await project.increment("views", { by: 1, silent: true });

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

    await project.increment("views", { by: 1, silent: true });

    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.incrementProjectView = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (project) {
      await project.increment("views", { by: 1, silent: true });
    }
    res.status(200).json({ message: "View incremented" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
