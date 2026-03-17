const sequelize = require("../config/database");
const fs = require("fs");
const path = require("path");

// GET Project Function
exports.getAllProjects = async (req, res) => {
  try {
    const query = `SELECT * FROM projects ORDER BY createdAt DESC`;

    const projects = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
    });

    res.status(200).json(projects);
  } catch (error) {
    console.error("Error GET Projects: ", error);
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
    } = req.body;
    console.log("--- DATA MASUK ---");
    console.log("Judul:", title);
    console.log("Status asli dari Frontend:", status);
    let coverImageName = null;
    let galleryImagesNames = [];

    if (req.files && req.files["cover_image"]) {
      coverImageName = req.files["cover_image"][0].filename;
    }

    if (req.files && req.files["gallery"]) {
      galleryImagesNames = req.files["gallery"].map((file) => file.filename);
    }

    const galleryJsonString = JSON.stringify(galleryImagesNames);

    // INSERT Raw Query
    const insertQuery = `
      INSERT INTO Projects (id, title, excerpt, content, category, status, cover_image, gallery, seo_title, meta_description, views, createdAt, updatedAt) 
      VALUES (UUID(), :title, :excerpt, :content, :category, :status, :cover_image, :gallery, :seo_title, :meta_description, 0, NOW(), NOW())
    `;

    await sequelize.query(insertQuery, {
      replacements: {
        title,
        excerpt: excerpt || "",
        content,
        category,
        status,
        cover_image: coverImageName, // Gunakan variabel yang benar
        gallery: JSON.stringify(galleryImagesNames), // Gunakan variabel yang benar
        seo_title: seo_title || title,
        meta_description: meta_description || excerpt,
      },
      type: sequelize.QueryTypes.INSERT,
    });

    res
      .status(201)
      .json({ message: "Project created successfully with images!" });
  } catch (error) {
    console.error("Error CREATE Project: ", error);
    res.status(500).json({ message: error.message });
  }
};

exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    console.log("🚀 Inline Upload Success:", fileUrl);

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

    // 1. Ambil data lengkap (termasuk content untuk cek gambar inline)
    const [project] = await sequelize.query(
      `SELECT cover_image, gallery, content FROM Projects WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT },
    );

    if (!project) return res.status(404).json({ message: "Project not found" });

    // --- HELPER DELETE FILE ---
    const deleteFile = (fileName) => {
      if (!fileName) return;
      // Ambil nama filenya saja jika yang tersimpan adalah URL lengkap
      const baseName = path.basename(fileName);
      const filePath = path.join(process.cwd(), "public", "uploads", baseName);

      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`Successfully deleted: ${baseName}`);
        } catch (e) {
          console.error(`Failed to delete file: ${baseName}`, e);
        }
      }
    };

    // A. Hapus Cover Image
    deleteFile(project.cover_image);

    // B. Hapus Image Gallery (Dengan Safety Check)
    if (project.gallery) {
      try {
        const galleryFiles =
          typeof project.gallery === "string"
            ? JSON.parse(project.gallery)
            : project.gallery;
        if (Array.isArray(galleryFiles)) {
          galleryFiles.forEach((file) => deleteFile(file));
        }
      } catch (e) {
        console.warn("Gallery format invalid, skipping gallery cleanup.");
      }
    }

    // C. Hapus Gambar di dalam Content (React Quill)
    // Mencari semua nama file di dalam tag <img src="...">
    if (project.content) {
      const imgRegex = /src="[^"]*\/uploads\/([^"]+)"/g;
      let match;
      while ((match = imgRegex.exec(project.content)) !== null) {
        deleteFile(match[1]); // match[1] adalah nama filenya
      }
    }

    // 2. Delete dari Database
    await sequelize.query(`DELETE FROM Projects WHERE id = :id`, {
      replacements: { id },
      type: sequelize.QueryTypes.DELETE,
    });

    res
      .status(200)
      .json({
        message:
          "Project and all associated files (including inline images) deleted successfully.",
      });
  } catch (error) {
    console.error("Error DELETE Project:", error);
    res.status(500).json({ message: "Failed to Delete Project." });
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM projects WHERE id = :id LIMIT 1`;

    const projects = await sequelize.query(query, {
      replacements: { id },
      type: sequelize.QueryTypes.SELECT,
    });

    if (projects.length === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.status(200).json(projects[0]);
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
      excerpt,
      content,
      category,
      status,
      existing_gallery,
      seo_title,
      meta_description,
    } = req.body;

    // 1. Ambil data lama untuk pengecekan file (opsional tapi disarankan)
    const [oldProject] = await sequelize.query(
      `SELECT cover_image, gallery FROM Projects WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT },
    );
    if (!oldProject)
      return res.status(404).json({ message: "Project not found" });

    // 2. Olah Gallery (Merge lama & baru)
    let finalGallery = [];
    if (existing_gallery) {
      try {
        finalGallery = JSON.parse(existing_gallery);
      } catch (e) {
        console.error("Gagal parse gallery lama:", existing_gallery);
        finalGallery = [];
      }
    }

    if (req.files && req.files["gallery"]) {
      const newImages = req.files["gallery"].map((file) => file.filename);
      finalGallery = [...finalGallery, ...newImages];
    }

    // 3. Olah Cover Image
    let coverImageName = oldProject.cover_image;
    if (req.files && req.files["cover_image"]) {
      coverImageName = req.files["cover_image"][0].filename;
    }

    // 4. Update Query (Bersih & Dinamis)
    const updateQuery = `
      UPDATE Projects 
      SET 
        title = :title, 
        excerpt = :excerpt, 
        content = :content, 
        category = :category, 
        status = :status, 
        cover_image = :cover_image,
        gallery = :gallery,
        seo_title = :seo_title,              
        meta_description = :meta_description,
        updatedAt = NOW()
      WHERE id = :id
    `;

    await sequelize.query(updateQuery, {
      replacements: {
        id,
        title: title || oldProject.title,
        excerpt: excerpt !== undefined ? excerpt : oldProject.excerpt,
        content: content || oldProject.content,
        category: category || oldProject.category,
        status: status || oldProject.status,
        cover_image: coverImageName,
        gallery: JSON.stringify(finalGallery),
        seo_title: seo_title || oldProject.seo_title || "",
        meta_description: meta_description || oldProject.meta_description || "",
      },
      type: sequelize.QueryTypes.UPDATE,
    });
    res.status(200).json({ message: "Project berhasil diupdate!" });
  } catch (error) {
    console.error("Error UPDATE Project:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getPublicProjects = async (req, res) => {
  try {
    const query = `SELECT id, title, excerpt, category, cover_image, createdAt, views FROM Projects WHERE status = 'Published' ORDER BY createdAt DESC`;
    const projects = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
    });
    res.status(200).json(projects);
  } catch (error) {
    console.error("Error GET Public Projects:", error);
    res.status(500).json({ message: "Failed to fetch projects." });
  }
};

exports.getPublicProjectById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM Projects WHERE id = :id AND status = 'Published' LIMIT 1`;
    const projects = await sequelize.query(query, {
      replacements: { id },
      type: sequelize.QueryTypes.SELECT,
    });

    if (projects.length === 0) {
      return res
        .status(404)
        .json({ message: "Project not found or not published" });
    }

    await sequelize.query(
      `UPDATE Projects SET views = views + 1 WHERE id = :id`,
      {
        replacements: { id },
        type: sequelize.QueryTypes.UPDATE,
      },
    );

    res.status(200).json(projects[0]);
  } catch (error) {
    console.error("Error GET Public Project Detail:", error);
    res.status(500).json({ message: "Failed to fetch project detail." });
  }
};

exports.incrementProjectView = async (req, res) => {
  try {
    const { id } = req.params;
    await sequelize.query(
      "UPDATE Projects SET views = views + 1 WHERE id = :id",
      { replacements: { id }, type: sequelize.QueryTypes.UPDATE },
    );
    res.status(200).json({ message: "View incremented" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
