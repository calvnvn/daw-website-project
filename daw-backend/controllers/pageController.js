const Page = require("../models/Page");
const { Op } = require("sequelize");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const window = new JSDOM("").window;
const dompurify = createDOMPurify(window);
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE || "040101";

// Helper: Strip HTML tags to get plain text
const stripHtml = (html) => html.replace(/<[^>]*>?/gm, "");

const generateUniqueSlug = async (title, slug, id = null) => {
  let baseSlug = (slug || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  let finalSlug = baseSlug;
  let counter = 1;
  while (true) {
    const whereClause = id ? { slug: finalSlug, id: { [Op.ne]: id } } : { slug: finalSlug };
    const existing = await Page.findOne({ where: whereClause });
    if (!existing) break;
    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  return finalSlug;
};

/**
 * Controller: Get all pages (Admin Sidebar List)
 * Optimizes performance by excluding heavy content fields
 */
exports.getAllPages = async (req, res) => {
  try {
    const pages = await Page.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "title", "slug"], // Lightweight fetch
    });
    res.status(200).json(pages);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch pages", error: error.message });
  }
};

/**
 * Controller: Get page by slug (Public view & Edit loader)
 */
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

/**
 * Controller: Upload Inline Image
 * Specifically handles images pasted or uploaded within the Quill Editor
 */
exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }

    // Construct the absolute URL to be stored in the HTML content
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    res.status(200).json({
      message: "Image uploaded successfully",
      url: fileUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("🚨 Inline Upload Error:", error);
    res.status(500).json({ message: "Failed to process editor image." });
  }
};

/**
 * Controller: Create Page
 * Handles slug generation, content sanitization, and SEO fallbacks
 */
exports.createPage = async (req, res) => {
  try {
    const {
      title,
      slug,
      subtitle,
      templateType,
      content,
      metaDescription,
      showDropCap,
      sidebarLinks, status
    } = req.body;

    const finalSlug = await generateUniqueSlug(title, slug);
    const sanitizedContent = dompurify.sanitize(content);
    const heroImage = req.file ? req.file.filename : null;

    // SEO Automation: Generate meta description from content if empty
    let finalMetaDesc = metaDescription || (subtitle ? subtitle.trim() : stripHtml(sanitizedContent).substring(0, 150));

    const pageData = {
      title,
      slug: finalSlug,
      subtitle,
      heroImage,
      templateType: templateType || "split",
      content: sanitizedContent,
      metaDescription: finalMetaDesc,
      showDropCap: showDropCap === "true",
      sidebarLinks: typeof sidebarLinks === "string" ? JSON.parse(sidebarLinks) : sidebarLinks || [],
    };

    // Editor Flow
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.owl_token;
      const result = await ErpApprovalService.initiateApproval({
        model: Page,
        targetId: null,
        action: "CREATE",
        payload: pageData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });
      return res.status(202).json({ message: "Permintaan pembuatan halaman baru dikirim ke OWL.", ticket: result.notrans });
    }

    // Superadmin Flow
    const newPage = await Page.create(pageData);
    res.status(201).json({ message: "Page created successfully", page: newPage });
  } catch (error) {
    res.status(500).json({ message: "Failed to create page", error: error.message });
  }
};

// Update Page
exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, subtitle, templateType, content, metaDescription, showDropCap, sidebarLinks, status } = req.body;

    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    // 🛡️ Safety Check: Gembok
    if (page.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({ message: "Halaman ini sedang dalam peninjauan Admin.", ticket: page.lock_ticket });
    }

    // --- PRE-PROCESSING ---
    const finalSlug = await generateUniqueSlug(title, slug, id);
    const sanitizedContent = dompurify.sanitize(content);
    let finalMetaDesc = metaDescription || stripHtml(sanitizedContent).substring(0, 150);

    let heroImageName = page.heroImage;
    let oldHeroToDelete = null;

    if (req.file) {
      oldHeroToDelete = page.heroImage;
      heroImageName = req.file.filename;
    }

    const updatedData = {
      title,
      slug: finalSlug,
      subtitle,
      heroImage: heroImageName,
      templateType: templateType || "split",
      content: sanitizedContent,
      metaDescription: finalMetaDesc,
      showDropCap: showDropCap === "true",
      sidebarLinks: typeof sidebarLinks === "string" ? JSON.parse(sidebarLinks) : sidebarLinks || [],
    };

    // Editor Flow
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.owl_token;
      const result = await ErpApprovalService.initiateApproval({
        model: Page,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });
      return res.status(202).json({ message: "Revisi halaman dikirim ke OWL.", ticket: result.notrans });
    }

    // Superadmin Flow
    if (oldHeroToDelete) deleteSingleFile(oldHeroToDelete);
    await page.update({ ...updatedData, is_locked: false, lock_ticket: null });
    res.status(200).json({ message: "Page updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update page", error: error.message });
  }
};

// 3. DELETE PAGE
exports.deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    // Editor Flow
    if (req.userRole?.toLowerCase() === "editor") {
      const tokenOWL = req.owl_token;
      const result = await ErpApprovalService.initiateApproval({
        model: Page,
        targetId: id,
        action: "DELETE",
        payload: { title: page.title },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });
      return res.status(202).json({ message: "Permintaan hapus halaman dikirim ke OWL. Data dikunci.", ticket: result.notrans });
    }

    // Superadmin Flow
    deleteSingleFile(page.heroImage);
    if (page.content) {
      const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
      let match;
      while ((match = imgRegex.exec(page.content)) !== null) {
        deleteSingleFile(match[1]);
      }
    }
    await page.destroy();
    res.status(200).json({ message: "Page deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete page", error: error.message });
  }
};