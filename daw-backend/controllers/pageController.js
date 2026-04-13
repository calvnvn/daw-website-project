const Page = require("../models/Page");
const { Op } = require("sequelize");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const window = new JSDOM("").window;
const dompurify = createDOMPurify(window);
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE || "040101";

/**
 * Helper: Strip HTML tags to get plain text
 * Used for generating SEO meta descriptions automatically
 */
const stripHtml = (html) => html.replace(/<[^>]*>?/gm, "");

/**
 * Helper: Generate a unique slug for the page
 * Recursively checks if slug exists and appends a counter if necessary
 * @param {string} title - Page title
 * @param {string} slug - Manually entered slug (optional)
 * @param {string} id - Current page ID to exclude during update checks
 */
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
      sidebarLinks,
    } = req.body;

    const finalSlug = await generateUniqueSlug(title, slug);
    const sanitizedContent = dompurify.sanitize(content);
    const heroImage = req.file ? req.file.filename : null;

    // SEO Automation: Generate meta description from content if empty
    let finalMetaDesc = metaDescription;
    if (!finalMetaDesc || finalMetaDesc.trim() === "") {
      if (subtitle && subtitle.trim() !== "") {
        // Fallback ke Subtitle jika ada
        finalMetaDesc = subtitle.trim();
      } else {
        // Terakhir: Fallback ke konten (strip HTML dan ambil 150 char)
        const cleanText = stripHtml(sanitizedContent);
        finalMetaDesc =
          cleanText.substring(0, 150) + (cleanText.length > 150 ? "..." : "");
      }
    }

    const newPage = await Page.create({
      title,
      slug: finalSlug,
      subtitle,
      heroImage,
      templateType: templateType || "split",
      content: sanitizedContent,
      metaDescription: finalMetaDesc,
      showDropCap: showDropCap === "true",
      sidebarLinks:
        typeof sidebarLinks === "string"
          ? JSON.parse(sidebarLinks)
          : sidebarLinks || [],
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

/**
 * Controller: Update Page
 * Manages image replacement and slug re-syncing
 */
exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      subtitle,
      templateType,
      content,
      metaDescription,
      showDropCap,
      sidebarLinks,
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

    let heroImageName = page.heroImage;
    let oldHeroToDelete = null;

    if (req.file) {
      oldHeroToDelete = page.heroImage;
      heroImageName = req.file.filename; // Akan ber-prefix TEMP_ jika Editor
    }

    // Gatekeeper: Editor
    if (req.userRole && req.userRole.toLowerCase() === "editor") {
      const packageContent = {
        title,
        slug: finalSlug,
        subtitle,
        heroImage: heroImageName,
        templateType: templateType || "split",
        content: sanitizedContent,
        metaDescription: finalMetaDesc,
        showDropCap: showDropCap === "true",
        sidebarLinks:
          typeof sidebarLinks === "string"
            ? JSON.parse(sidebarLinks)
            : sidebarLinks || [],
      };

      await ErpApprovalService.createDraft(
        {
          jenisApproval: JENIS_APP_CMS,
          karyawanid: req.userId,
          module: "Page",
          action: "UPDATE",
          targetId: id,
          content: packageContent,
        },
        req.headers["authorization"]?.split(" ")[1],
      );

      return res
        .status(202)
        .json({ message: "Revisi halaman berhasil dikirim ke antrean Admin." });
    }

    // Admin Flow
    if (oldHeroToDelete) deleteSingleFile(oldHeroToDelete);
    await page.update({
      title,
      slug: finalSlug,
      subtitle,
      heroImage: heroImageName,
      templateType: templateType || "split",
      content: sanitizedContent,
      metaDescription: finalMetaDesc,
      showDropCap: showDropCap === "true",
      sidebarLinks:
        typeof sidebarLinks === "string"
          ? JSON.parse(sidebarLinks)
          : sidebarLinks || [],
    });

    res.status(200).json({ message: "Page updated successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update page", error: error.message });
  }
};

/**
 * Controller: Delete Page
 * Triggers cascading cleanup of physical hero image and editor inline images
 */
exports.deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    // Step 1: Physical removal of Hero Image
    deleteSingleFile(page.heroImage);

    // Step 2: Physical removal of all hosted images found in the Rich Text content
    if (page.content) {
      // Regex detects filenames within src attributes that point to our uploads folder
      const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
      let match;
      while ((match = imgRegex.exec(page.content)) !== null) {
        deleteSingleFile(match[1]); // match[1] extracts the specific filename
      }
    }
    await page.destroy();
    res
      .status(200)
      .json({ message: "Page and all associated assets deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete page", error: error.message });
  }
};
