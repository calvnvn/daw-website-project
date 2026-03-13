const Page = require("../models/Page");

// Ambil semua page (Untuk pilihan di Admin Panel)
exports.getAllPages = async (req, res) => {
  try {
    const pages = await Page.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "title", "slug"], // Jangan tarik content HTML berat jika hanya untuk list
    });
    res.status(200).json(pages);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch pages", error: error.message });
  }
};

// Ambil satu page spesifik beserta konten HTML-nya (Untuk Website Publik)
exports.getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const page = await Page.findOne({ where: { slug } });

    if (!page) return res.status(404).json({ message: "Page not found" });

    res.status(200).json(page);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching page", error: error.message });
  }
};

// Admin CRUD
exports.createPage = async (req, res) => {
  try {
    const { title, slug, content, metaDescription } = req.body;
    const newPage = await Page.create({
      title,
      slug,
      content,
      metaDescription,
    });
    res
      .status(201)
      .json({ message: "Page created successfully", page: newPage });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create page", error: error.message });
  }
};

exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, metaDescription } = req.body;

    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    await page.update({ title, slug, content, metaDescription });
    res.status(200).json({ message: "Page updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update page", error: error.message });
  }
};

exports.deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    await page.destroy();
    res.status(200).json({ message: "Page deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete page", error: error.message });
  }
};
