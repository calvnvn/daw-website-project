const Page = require("../models/Page");
const { Op } = require("sequelize");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const window = new JSDOM("").window;
const dompurify = createDOMPurify(window);

const stripHtml = (html) => html.replace(/<[^>]*>?/gm, "");

// --- HELPER: GENERATE UNIQUE SLUG ---
const generateUniqueSlug = async (title, slug, id = null) => {
  let baseSlug = (slug || title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  let finalSlug = baseSlug;
  let counter = 1;

  while (true) {
    const whereClause = id
      ? { slug: finalSlug, id: { [Op.ne]: id } }
      : { slug: finalSlug };

    const existing = await Page.findOne({ where: whereClause });

    if (!existing) break;

    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  return finalSlug;
};

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
    const {
      title,
      slug,
      subtitle,
      heroImage,
      templateType,
      content,
      metaDescription,
    } = req.body;

    const finalSlug = await generateUniqueSlug(title, slug);
    const sanitizedContent = dompurify.sanitize(content);

    // 🚀 SEO AUTOMATION LIMIT BREAK
    // Jika meta deskripsi kosong, ambil dari konten mentah sebanyak 150 karakter
    let finalMetaDesc = metaDescription;
    if (!finalMetaDesc || finalMetaDesc.trim() === "") {
      const cleanText = stripHtml(sanitizedContent);
      finalMetaDesc =
        cleanText.substring(0, 150) + (cleanText.length > 150 ? "..." : "");
    }

    const newPage = await Page.create({
      title,
      slug: finalSlug,
      subtitle,
      heroImage, // State terpisah yang kita bahas tadi
      templateType,
      content: sanitizedContent,
      metaDescription: finalMetaDesc,
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
    const {
      title,
      slug,
      subtitle,
      heroImage,
      templateType,
      content,
      metaDescription,
    } = req.body;

    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    const finalSlug = await generateUniqueSlug(title, slug, id);
    const sanitizedContent = dompurify.sanitize(content);

    let finalMetaDesc = metaDescription;
    if (!finalMetaDesc || finalMetaDesc.trim() === "") {
      const cleanText = stripHtml(sanitizedContent);
      finalMetaDesc =
        cleanText.substring(0, 150) + (cleanText.length > 150 ? "..." : "");
    }
    await page.update({
      title,
      slug: finalSlug,
      subtitle,
      heroImage,
      templateType,
      content: sanitizedContent,
      metaDescription: finalMetaDesc,
    });

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
