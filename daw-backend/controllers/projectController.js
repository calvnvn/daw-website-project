const Project = require("../models/Project");
const BusinessSection = require("../models/BusinessSection");
const { deleteSingleFile } = require("../utils/fileRemover");
const { Op } = require("sequelize");
const ErpApprovalService = require("../services/erpApprovalService");

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
    const finalSlug = await generateUniqueProjectSlug(title);
    console.log(" Creating Project:", title);

    // 1. Handle Upload Files
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

    // 2. Pakai Project.create (ORM)
    // ID (UUID) biasanya sudah di-handle otomatis di Model atau Database
    const newProject = await Project.create({
      title,
      slug: finalSlug,
      author: author || "Admin DAW",
      excerpt: excerpt || "",
      content,
      category,
      status: status || "Draft",
      cover_image: coverImageName,
      gallery: galleryImagesNames, // Masukkan Array langsung, Sequelize yang simpan jadi JSON
      seo_title: seo_title || title,
      meta_description: meta_description || excerpt,
      views: 0,
    });

    res.status(201).json({
      message: "Project created successfully!",
      data: newProject,
    });
  } catch (error) {
    console.error("🚨 Error CREATE Project:", error);
    res.status(500).json({ message: error.message });
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

    deleteSingleFile(project.cover_image);

    // Hapus Gallery (Parsing dulu jika string)
    const gallery =
      typeof project.gallery === "string"
        ? JSON.parse(project.gallery || "[]")
        : project.gallery;

    if (Array.isArray(gallery)) {
      gallery.forEach((file) => deleteSingleFile(file));
    }

    // Hapus Gambar dari Content Quill (Regex)
    if (project.content) {
      const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
      let match;
      while ((match = imgRegex.exec(project.content)) !== null) {
        deleteSingleFile(match[1]); // match[1] adalah nama filenya
      }
    }

    await project.destroy();

    res.status(200).json({ message: "Project and associated files deleted!" });
  } catch (error) {
    console.error("🚨 Error DELETE Project:", error);
    res.status(500).json({ message: "Failed to Delete Project." });
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
      oldCoverToDelete = project.cover_image; // Tampung nama lama
      coverImageName = req.files["cover_image"][0].filename; // Ini sudah pakai nama "TEMP_" kalau dia Editor
    }

    let finalSlug = project.slug;
    if (slug && slug !== project.slug) {
      finalSlug = await generateUniqueProjectSlug(slug, id);
    } else if (title && title !== project.title) {
      finalSlug = await generateUniqueProjectSlug(title, id);
    }
    // Gatekeeper: Pemisahan Logic Flow
    // JALUR 1: Jika Editor klik "Publish" (Kirim ke ERP DAW)
    if (
      req.userRole &&
      req.userRole.toLowerCase() === "editor" &&
      status === "Published"
    ) {
      console.log(">>> JALUR EDITOR (REQUEST APPROVAL KE OWL) <<<");

      const packageContent = {
        title: title || project.title,
        slug: finalSlug,
        excerpt: excerpt !== undefined ? excerpt : project.excerpt,
        content: content || project.content,
        category: category || project.category,
        status: status || project.status, // Ini akan bernilai "Published"
        cover_image: coverImageName,
        gallery: finalGallery,
        seo_title: seo_title || project.seo_title,
        meta_description: meta_description || project.meta_description,
      };

      const tokenOWL = req.headers["authorization"]?.split(" ")[1];

      await ErpApprovalService.createDraft(
        {
          jenisApproval: JENIS_APP_CMS,
          karyawanid: req.userId,
          module: "Project",
          action: "UPDATE",
          targetId: id,
          content: packageContent,
        },
        tokenOWL,
      );

      return res.status(202).json({
        message:
          "Draf revisi berhasil dikirim ke antrean Admin DAW untuk diperiksa.",
      });
    }

    // JALUR 2: Alur Normal (Berjalan jika: User = Admin, ATAU Editor simpan sebagai "Draft")
    console.log(">>> JALUR UPDATE LOKAL (MYSQL) DIAKTIFKAN <<<");

    // Jika Editor simpan draf, kita tidak hapus file lama dulu (karena belum final)
    // Tapi jika Admin yang update, baru kita hapus file lamanya
    if (req.userRole && req.userRole.toLowerCase() !== "editor") {
      filesToDelete.forEach((file) => deleteSingleFile(file));
      if (oldCoverToDelete) deleteSingleFile(oldCoverToDelete);
    }

    // Update MySQL Lokal (Status di sini bisa "Draft" atau "Published" tergantung siapa yang klik)
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
    });

    res.status(200).json({
      message:
        status === "Draft"
          ? "Draf proyek berhasil disimpan di workspace lokal!"
          : "Project berhasil diupdate secara langsung!",
    });
  } catch (error) {
    console.error("🚨 ERROR UPDATE PROJECT:", error);
    res.status(500).json({ message: error.message });
  }
};

// Ganti fungsi getPublicProjects kamu dengan ini:
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
      where: { slug: slug, status: "Published" },
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
