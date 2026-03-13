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
    const { title, excerpt, content, category, status, author } = req.body;
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
    const query = `
  INSERT INTO Projects (id, title, excerpt, content, category, status, author, cover_image, gallery, views, createdAt, updatedAt) 
  VALUES (UUID(), :title, :excerpt, :content, :category, :status, :author, :cover_image, :gallery, 0, NOW(), NOW())
`;

    await sequelize.query(query, {
      replacements: {
        title: title || "Untitled Project",
        excerpt: excerpt || "",
        content: content || "",
        category: category || "Resources",
        status: status || "Draft",
        author: author || "Admin",
        cover_image: coverImageName,
        gallery: galleryJsonString,
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
      return res.status(400).json({ message: "No imiage file provided." });
    }
    const protocol = req.protocol; // http
    const host = req.get("host"); // localhost:5000
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

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

    const [project] = await sequelize.query(
      `SELECT cover_image, gallery FROM Projects WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT },
    );

    if (!project) return res.status(404).json({ message: "Project not found" });

    const deleteFile = (fileName) => {
      if (!fileName) return;
      const filePath = path.join(__dirname, "../uploads", fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    };

    // Delete Cover Image
    deleteFile(project.cover_image);

    // Delete Image Gallery
    if (project.gallery) {
      const galleryFiles = JSON.parse(project.gallery);
      galleryFiles.forEach((file) => deleteFile(file));
    }

    // Delete from SQL
    await sequelize.query(`DELETE FROM Projects WHERE id = :id`, {
      replacements: { id },
      type: sequelize.QueryTypes.DELETE,
    });
    res.status(200).json({ message: "Project and associated files deleted." });
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
    const { title, excerpt, content, category, status, existing_gallery } =
      req.body;

    // 1. Ambil data lama untuk pengecekan file (opsional tapi disarankan)
    const [oldProject] = await sequelize.query(
      `SELECT cover_image, gallery FROM Projects WHERE id = :id`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT },
    );
    if (!oldProject)
      return res.status(404).json({ message: "Project tidak ditemukan" });

    // 2. Olah Gallery (Merge lama & baru)
    let finalGallery = [];
    if (existing_gallery) {
      finalGallery = JSON.parse(existing_gallery);
    }
    if (req.files && req.files["gallery"]) {
      const newImages = req.files["gallery"].map((file) => file.filename);
      finalGallery = [...finalGallery, ...newImages];
    }

    // 3. Olah Cover Image
    let coverImageName = oldProject.cover_image; // Default pakai yang lama
    if (req.files && req.files["cover_image"]) {
      // Hapus file fisik lama jika ada
      const oldPath = path.join(
        __dirname,
        "../uploads",
        oldProject.cover_image,
      );
      if (oldProject.cover_image && fs.existsSync(oldPath))
        fs.unlinkSync(oldPath);

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
