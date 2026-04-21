const Project = require("../models/Project");
const BusinessSection = require("../models/BusinessSection");
const { deleteSingleFile } = require("../utils/fileRemover");
const { Op } = require("sequelize");
const ErpApprovalService = require("../services/erpApprovalService");
const { token } = require("morgan");
const { invalidateOldDrafts } = require("../utils/draftCleanup");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// Slug Generator
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

// GET Project Function
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [
        {
          model: BusinessSection,
          as: "sectorData",
          attributes: ["category"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST Project Function
exports.createProject = async (req, res) => {
  let newProject = null;

  try {
    // Fetch Data
    const projectData = await prepareProjectData(req);
    const { previous_notrans } = req.body;

    // Buat record di lokal dulu
    // Status default di projectData biasanya 'Draft'
    newProject = await Project.create(projectData);

    // Editor: Handshake OWL
    if (
      req.userRole?.toLowerCase() === "editor" &&
      req.body.status === "Published"
    ) {
      try {
        // ADDED: Handle Re-submission
        // Jika ini adalah pengajuan ulang draf yang pernah ditolak
        if (previous_notrans) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            { where: { notrans: previous_notrans } },
          );
        }

        const result = await ErpApprovalService.initiateApproval({
          model: Project,
          targetId: newProject.id,
          action: "CREATE",
          payload: { ...projectData, status: "Published" },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        // Data asli dikunci karena sedang diajukan
        await newProject.update({
          is_locked: true,
          lock_ticket: result.notrans,
        });

        return res.status(202).json({
          message: "Diajukan . Data dikunci menunggu persetujuan.",
          ticket: result.notrans,
          data: newProject,
        });
      } catch (owlError) {
        // Jika jembatan ke OWL putus, hancurkan record draf yang baru dibuat
        if (newProject) {
          console.error(
            `>>> [CLEANUP] Deleting orphan project ID: ${newProject.id} due to server failure`,
          );
          await newProject.destroy();
        }
        throw owlError; // Lemparkan ke catch utama
      }
    }

    // Superadmin atau Editor save draft
    if (req.body.status === "Published") {
      await newProject.update({ status: "Published" });
    }

    return res.status(201).json({
      message: "Proyek berhasil disimpan.",
      data: newProject,
    });
  } catch (error) {
    console.error("🚨 Error CREATE Project:", error);
    res.status(500).json({
      message: "Gagal memproses permintaan.",
      error: error.message,
    });
  }
};

exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    console.log(" Inline Upload Success:", fileUrl);

    res.status(200).json({
      message: "Image uploaded succesfully",
      url: fileUrl,
    });
  } catch (error) {
    console.error("Error Upload Inline Image: ", error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProject = async (req, res) => {
  const t = await sequelize.transaction(); // 🛡️ Buka Transaksi
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();

    const project = await Project.findByPk(id, { transaction: t });
    if (!project) {
      await t.rollback();
      return res.status(404).json({ message: "Project not found" });
    }

    // 🔒 THE GATEKEEPER
    if (project.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Data terkunci karena sedang dalam proses approval.",
        ticket: project.lock_ticket,
      });
    }

    // --- JALUR EDITOR: REQUEST DELETE ---
    if (userRole === "editor") {
      const tokenOWL = req.owl_token;
      if (!tokenOWL) {
        await t.rollback();
        return res
          .status(401)
          .json({ message: "Akses ditolak: Token tidak ditemukan." });
      }

      await project.update({ is_locked: true }, { transaction: t });

      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "Project",
          targetId: id,
          action: "DELETE",
          payload: {
            title: project.title,
            reason: "User meminta penghapusan proyek",
          },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: tokenOWL,
        });

        await project.update(
          { lock_ticket: result.notrans },
          { transaction: t },
        );
        await t.commit(); // ✅ Selesai jalur Editor

        return res.status(202).json({
          message:
            "Permintaan penghapusan dikirim. Data dikunci sampai disetujui.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        await project.update({ is_locked: false }, { transaction: t });
        await t.commit();
        throw owlError;
      }
    }

    // --- JALUR SUPERADMIN: PERMANENT DELETION ---
    console.log(`>>> [PROJECT] ADMIN OVERRIDE: Deleting Project ID ${id}`);

    // 1. Bunuh draf lama (misal draf update/delete yang lagi gantung)
    await invalidateOldDrafts("Project", id, t);

    // 2. Hapus DB
    await project.destroy({ transaction: t });

    await t.commit(); // ✅ Selesai jalur Admin (Database bersih)

    // 3. Hapus File Fisik (Setelah DB dipastikan terhapus)
    if (project.cover_image) deleteSingleFile(project.cover_image);

    const gallery =
      typeof project.gallery === "string"
        ? JSON.parse(project.gallery || "[]")
        : project.gallery;
    if (Array.isArray(gallery))
      gallery.forEach((file) => deleteSingleFile(file));

    if (project.content) {
      const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
      let match;
      while ((match = imgRegex.exec(project.content)) !== null) {
        deleteSingleFile(match[1]);
      }
    }

    res
      .status(200)
      .json({ message: "Project and associated files deleted permanently!" });
  } catch (error) {
    if (t) await t.rollback();
    console.error("🚨 Error DELETE Project:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json(project);
  } catch (error) {
    console.error("Error GET Project by ID: ", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateProject = async (req, res) => {
  const t = await sequelize.transaction(); // 🛡️ Buka Transaksi
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    console.log(">>> DEBUG ROLE:", userRole, "ID:", req.userId);

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
      previous_notrans,
    } = req.body;

    const project = await Project.findByPk(id, { transaction: t });
    if (!project) {
      await t.rollback();
      return res.status(404).json({ message: "Project not found" });
    }

    // 🔒 THE GATEKEEPER (Role-Aware Lock Guard)
    if (project.is_locked) {
      if (userRole === "editor") {
        await t.rollback();
        return res.status(423).json({
          message: "Data sedang dikunci oleh proses approval OWL.",
          ticket: project.lock_ticket,
        });
      }

      // Jika Superadmin, kita lanjut tapi catat log
      console.log(
        `>>> [OVERRIDE] Superadmin mem-bypass kunci pada Proyek ID: ${id}`,
      );
    }

    // 📸 ASSET PROCESSING (Sama seperti logika lo sebelumnya)
    let finalGallery = [];
    let filesToDelete = [];

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

    let coverImageName = project.cover_image;
    let oldCoverToDelete = null;

    if (req.files && req.files["cover_image"]) {
      oldCoverToDelete = project.cover_image;
      coverImageName = req.files["cover_image"][0].filename;
    }

    // 📝 SLUG PROCESSING
    let finalSlug = project.slug;
    if (slug && slug !== project.slug) {
      finalSlug = await generateUniqueProjectSlug(slug, id);
    } else if (title && title !== project.title) {
      finalSlug = await generateUniqueProjectSlug(title, id);
    }

    const packageContent = {
      title: title || project.title,
      slug: finalSlug,
      excerpt: excerpt !== undefined ? excerpt : project.excerpt,
      content: content || project.content,
      category: category || project.category,
      status: status || project.status, // Gunakan status dari body jika ada
      cover_image: coverImageName,
      gallery: finalGallery,
      seo_title: seo_title || project.seo_title,
      meta_description: meta_description || project.meta_description,
    };

    // --- JALUR EDITOR: REQUEST UPDATE ---
    if (userRole === "editor" && status === "Published") {
      // 1. Cleanup draf lama (Resubmission)
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      // 2. Lock Data Lokal
      await project.update({ is_locked: true }, { transaction: t });

      // 3. Network Call (Di luar transaksi untuk menghindari pool exhaustion)
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: "Project", // Sesuai Registry
          targetId: id,
          action: "UPDATE",
          payload: { ...packageContent, status: "Published" }, // Paksa status published untuk draf
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        // 4. Catat tiket
        await project.update(
          { lock_ticket: result.notrans },
          { transaction: t },
        );
        await t.commit(); // ✅ Selesai jalur Editor

        return res.status(202).json({
          message: "Revisi diajukan. Data asli dikunci.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        // Rollback lock jika network gagal
        await project.update({ is_locked: false }, { transaction: t });
        await t.commit(); // Commit rollback manual ini
        throw owlError;
      }
    }

    // --- JALUR SUPERADMIN ATAU EDITOR SAVE DRAFT: DIRECT COMMIT ---
    // 1. Bunuh draf lama jika Admin nge-bypass (PENTING!)
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts("Project", id, t);
    }

    // 2. Update Database (Buka gembok jika sedang terkunci)
    await project.update(
      {
        ...packageContent,
        is_locked: false,
        lock_ticket: null,
      },
      { transaction: t },
    );

    await t.commit(); // ✅ Selesai jalur Admin/Draft

    // 3. Cleanup File Fisik (Setelah DB aman)
    if (
      userRole === "superadmin" ||
      (userRole === "editor" && status === "Draft")
    ) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
      if (oldCoverToDelete) deleteSingleFile(oldCoverToDelete);
    }

    res.status(200).json({
      message:
        status === "Draft"
          ? "Draf lokal disimpan."
          : "Pembaruan langsung berhasil (Override).",
    });
  } catch (error) {
    if (t) await t.rollback(); // ❌ Batalkan semua perubahan jika error
    console.error("🚨 ERROR UPDATE PROJECT:", error);
    res.status(500).json({ message: error.message });
  }
};

// Ganti fungsi getPublicProjects kamu dengan ini
exports.getPublicProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      where: { status: "Published" },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(projects);
  } catch (error) {
    console.error("🚨 ERROR GET PUBLIC PROJECTS:", error);
    res.status(500).json({
      message: "Failed to fetch public projects.",
      error: error.message,
    });
  }
};

exports.getPublicProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findOne({
      where: { id: id, status: "Published" },
    });

    if (!project) {
      return res
        .status(404)
        .json({ message: "Project not found or not published" });
    }

    // Increment views dengan cara yang lebih aman
    await project.increment("views", { by: 1 });

    res.status(200).json(project);
  } catch (error) {
    console.error("Error GET Public Project Detail:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.incrementProjectView = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (project) {
      await project.increment("views", { by: 1 });
    }
    res.status(200).json({ message: "View incremented" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Tambahkan fungsi baru ini
exports.getPublicProjectBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const project = await Project.findOne({
      where: { slug: slug, status: "Published" },
    });

    if (!project) {
      return res
        .status(404)
        .json({ message: "Project not found or not published" });
    }

    await project.increment("views", { by: 1 });
    res.status(200).json(project);
  } catch (error) {
    console.error("Error GET Public Project Detail by Slug:", error);
    res.status(500).json({ message: error.message });
  }
};
