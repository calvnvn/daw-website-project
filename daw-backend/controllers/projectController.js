const Project = require("../models/Project");
const BusinessSection = require("../models/BusinessSection");
const { deleteSingleFile } = require("../utils/fileRemover");
const { Op } = require("sequelize");
const ErpApprovalService = require("../services/erpApprovalService");
const { token } = require("morgan");

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
  try {
    const {
      title,
      excerpt,
      content,
      category,
      status,
      seo_title,
      meta_description,
      author,
    } = req.body;

    // --- 1. PRE-PROCESSING DATA (Berlaku untuk semua Role) ---
    const finalSlug = await generateUniqueProjectSlug(title);

    let coverImageName = null;
    let galleryImagesNames = [];

    if (req.files) {
      if (req.files["cover_image"]) {
        coverImageName = req.files["cover_image"][0].filename;
      }
      if (req.files["gallery"]) {
        galleryImagesNames = req.files["gallery"].map((file) => file.filename);
      }
    }

    const projectData = {
      title,
      slug: finalSlug,
      author: author || "Admin DAW",
      excerpt: excerpt || "",
      content,
      category,
      status: status || "Draft",
      cover_image: coverImageName,
      gallery: galleryImagesNames,
      seo_title: seo_title || title,
      meta_description: meta_description || excerpt,
      views: 0,
    };

    // --- 2. GATEKEEPER LOGIC ---
    if (req.userRole === "Editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: Project,
        targetId: null,
        action: "CREATE",
        payload: projectData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token, // decoded token middleware
      });

      return res.status(202).json({
        message: "Permintaan publish sedang diproses di OWL.",
        ticket: result.notrans,
      });
    }

    // Jalur Superadmin ATAU Editor yang cuma save Draft
    // CMS Buta: Superadmin nggak perlu tau layer OWL ada berapa.
    console.log(">>> [PROJECT] JALUR DIRECT: CREATING LOCAL RECORD <<<");
    const newProject = await Project.create(projectData);

    return res.status(201).json({
      message: "Proyek berhasil disimpan secara langsung.",
      data: newProject,
    });
  } catch (error) {
    console.error("🚨 Error CREATE Project:", error);
    res
      .status(500)
      .json({ message: "Gagal membuat proyek.", error: error.message });
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
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (project.is_locked) {
      return res.status(423).json({
        message:
          "Data terkunci karena sedang dalam proses approval. Batalkan tiket di OWL terlebih dahulu.",
        ticket: project.lock_ticket,
      });
    }

    // Editor Flow
    if (req.userRole && req.userRole.toLowerCase() === "editor") {
      console.log(
        `>>> [PROJECT] JALUR EDITOR: REQUESTING DELETE FOR ID: ${id} <<<`,
      );

      const tokenOWL = req.owl_token;
      if (!tokenOWL) {
        return res
          .status(401)
          .json({ message: "Akses ditolak: Token OWL tidak ditemukan." });
      }

      // 2. Kirim Niat Hapus ke Orchestrator
      // Kita kirim payload minimal saja agar Approver tahu data mana yang mau dihapus
      const result = await ErpApprovalService.initiateApproval({
        model: Project,
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

      // 3. Respon ke Frontend
      // Catatan: is_locked otomatis diset true oleh initiateApproval
      return res.status(202).json({
        message:
          "Permintaan penghapusan telah dikirim. Data akan tetap ada (dikunci) sampai disetujui Admin.",
        ticket: result.notrans,
      });
    }

    // --- JALUR SUPERADMIN: EKSEKUSI LANGSUNG ---
    console.log(">>> [PROJECT] JALUR SUPERADMIN: PERMANENT DELETION <<<");

    // 1. Hapus File Fisik (Cover Image)
    if (project.cover_image) {
      deleteSingleFile(project.cover_image);
    }

    // 2. Hapus Gallery (Parsing dulu jika perlu)
    const gallery =
      typeof project.gallery === "string"
        ? JSON.parse(project.gallery || "[]")
        : project.gallery;

    if (Array.isArray(gallery)) {
      gallery.forEach((file) => deleteSingleFile(file));
    }

    // 3. Hapus Gambar di dalam Konten (Quill Regex)
    if (project.content) {
      const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
      let match;
      while ((match = imgRegex.exec(project.content)) !== null) {
        deleteSingleFile(match[1]);
      }
    }

    // 4. Hapus Record di Database
    await project.destroy();

    res
      .status(200)
      .json({ message: "Project and associated files deleted permanently!" });
  } catch (error) {
    console.error("🚨 Error DELETE Project:", error);
    res
      .status(500)
      .json({
        message: "Failed to process delete request.",
        error: error.message,
      });
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
  try {
    const { id } = req.params;
    console.log("DEBUG ROLE:", req.userRole);
    console.log("DEBUG USER ID:", req.userId);
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

    // Cari data lama (Gak perlu raw query, cukup findByPk)
    const project = await Project.findByPk(id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.is_locked) {
      return res.status(423).json({
        message: "Data sedang dalam proses approval di OWL dan terkunci.",
        ticket: project.lock_ticket,
      });
    }

    // Olah Gallery
    let finalGallery = [];
    let filesToDelete = []; // Penampung

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

    // Olah Cover Image
    let coverImageName = project.cover_image;
    let oldCoverToDelete = null;

    if (req.files && req.files["cover_image"]) {
      oldCoverToDelete = project.cover_image;
      coverImageName = req.files["cover_image"][0].filename;
    }

    // Olah Slug
    let finalSlug = project.slug;
    if (slug && slug !== project.slug) {
      finalSlug = await generateUniqueProjectSlug(slug, id);
    } else if (title && title !== project.title) {
      finalSlug = await generateUniqueProjectSlug(title, id);
    }

    const userRole = req.userRole?.toLowerCase();
    if (userRole === "editor" && status === "Published") {
      console.log(">>> [PROJECT] JALUR EDITOR: INITIATING WORKFLOW <<<");

      const packageContent = {
        title: title || project.title,
        slug: finalSlug,
        excerpt: excerpt !== undefined ? excerpt : project.excerpt,
        content: content || project.content,
        category: category || project.category,
        status: "Published",
        cover_image: coverImageName,
        gallery: finalGallery,
        seo_title: seo_title || project.seo_title,
        meta_description: meta_description || project.meta_description,
      };

      const result = await ErpApprovalService.initiateApproval({
        model: Project,
        targetId: id,
        action: "UPDATE",
        payload: packageContent,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token, // Pastikan middleware nyimpen ini
      });

      return res.status(202).json({
        message: "Revisi diajukan ke OWL. Data asli dikunci.",
        ticket: result.notrans,
      });
    }

    // ⚡ JALUR SUPERADMIN ATAU EDITOR SIMPAN DRAFT
    console.log(">>> [PROJECT] JALUR DIRECT: UPDATING LOCAL DATABASE <<<");

    // HANYA hapus file fisik jika yang melakukan adalah Superadmin
    // atau jika Editor menyimpan sebagai Draft (dan memang ada file yang diganti)
    if (
      userRole === "superadmin" ||
      (userRole === "editor" && status === "Draft")
    ) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
      if (oldCoverToDelete) deleteSingleFile(oldCoverToDelete);
    }

    await project.update({
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
      is_locked: false, // Pastikan tidak terkunci
      lock_ticket: null,
    });

    res.status(200).json({
      message:
        status === "Draft"
          ? "Draf berhasil disimpan."
          : "Update berhasil di-commit langsung.",
    });
  } catch (error) {
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
