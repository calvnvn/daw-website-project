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

// 1. Get All Pages (Untuk Sidebar List Admin)
exports.getAllPages = async (req, res) => {
  try {
    const pages = await Page.findAll({
      order: [["createdAt", "DESC"]],
      // 🚀 Tetap ringan, jangan tarik content & sidebarLinks untuk list
      attributes: ["id", "title", "slug"],
    });
    res.status(200).json(pages);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch pages", error: error.message });
  }
};

// 2. Get Page By Slug (Untuk Publik & Load Detail Edit)
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

// 3. Create Page
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
      showDropCap,
      sidebarLinks, // 🚀 1. TANGKAP DARI REQ.BODY
    } = req.body;

    const finalSlug = await generateUniqueSlug(title, slug);
    const sanitizedContent = dompurify.sanitize(content);

    // SEO Automation
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
      heroImage,
      templateType: templateType || "split",
      content: sanitizedContent,
      metaDescription: finalMetaDesc,
      showDropCap,
      sidebarLinks: sidebarLinks || [],
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

// 4. Update Page
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
      showDropCap,
      sidebarLinks, // 🚀 1. TANGKAP DARI REQ.BODY (Tadinya Abang lupa bagian ini)
    } = req.body;

    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    const finalSlug = await generateUniqueSlug(title, slug, id);
    const sanitizedContent = dompurify.sanitize(content);

    // SEO Automation
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
      templateType: templateType || "split",
      content: sanitizedContent,
      metaDescription: finalMetaDesc,
      showDropCap,
      sidebarLinks: sidebarLinks || [], // 🚀 2. UPDATE KE DATABASE
    });

    res.status(200).json({ message: "Page updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update page", error: error.message });
  }
};

// 5. Delete Page
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
