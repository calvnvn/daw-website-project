const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { JSDOM } = require("jsdom");
const createDOMPurify = require("dompurify");
const window = new JSDOM("").window;
const dompurify = createDOMPurify(window);

const sequelize = require("../config/database");
const Page = require("../models/Page");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE || "040101";

const stripHtml = (html) => html.replace(/<[^>]*>?/gm, "");

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
      attributes: ["id", "title", "slug", "is_locked", "lock_ticket"],
    });
    res.status(200).json(pages);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch pages", error: error.message });
  }
};

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

exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }
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

exports.createPage = async (req, res) => {
  let newPage = null;
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
      status,
      previous_notrans,
    } = req.body;
    const userRole = req.userRole?.toLowerCase();

    const finalSlug = await generateUniqueSlug(title, slug);
    const sanitizedContent = dompurify.sanitize(content);
    let finalMetaDesc =
      metaDescription ||
      (subtitle
        ? subtitle.trim()
        : stripHtml(sanitizedContent).substring(0, 150)); // SEO Automation

    let heroImageName = req.file ? req.file.filename : null;

    const pageData = {
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

    // Fast local commit
    const t = await sequelize.transaction();
    try {
      // PRE-INSERT: Selalu jadikan Draft lokal dulu untuk mengamankan Target ID
      newPage = await Page.create(
        { ...pageData, status: "Draft" },
        { transaction: t },
      );
      await t.commit();
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }

    // Network Call (Editor Gate)
    if (userRole === "editor" && status === "Published") {
      try {
        if (previous_notrans) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            { where: { notrans: previous_notrans } },
          );
        }

        const result = await ErpApprovalService.initiateApproval({
          model: Page,
          targetId: newPage.id,
          action: "CREATE",
          payload: { ...pageData, status: "Published" },
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        await newPage.update({ is_locked: true, lock_ticket: result.notrans });
        return res.status(202).json({
          message: "Permintaan pembuatan halaman baru dikirim . Data dikunci.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error(
          `🚨 [CLEANUP] Menghapus orphan page ID: ${newPage.id} karena gagal koneksi OWL.`,
        );
        await newPage.destroy();
        throw owlError;
      }
    }

    // Superadmin Flow
    if (status === "Published") await newPage.update({ status: "Published" });
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
      templateType,
      content,
      metaDescription,
      showDropCap,
      sidebarLinks,
      status,
      previous_notrans,
    } = req.body;
    const userRole = req.userRole?.toLowerCase();

    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    // Safety Check
    if (page.is_locked && userRole === "editor") {
      return res.status(423).json({
        message: "Halaman ini sedang dalam peninjauan Admin.",
        ticket: page.lock_ticket,
      });
    }

    const finalSlug = await generateUniqueSlug(title, slug, id);
    const sanitizedContent = dompurify.sanitize(content);
    let finalMetaDesc =
      metaDescription || stripHtml(sanitizedContent).substring(0, 150);

    let heroImageName = page.heroImage;
    let oldHeroToDelete = null;

    if (req.file) {
      oldHeroToDelete = page.heroImage;
      heroImageName = req.file.filename;

      // TEMP_ prefixing logic
      if (userRole === "editor" && status === "Published") {
        const oldPath = path.join(
          process.cwd(),
          "public/uploads",
          heroImageName,
        );
        heroImageName = `TEMP_${heroImageName}`;
        const newPath = path.join(
          process.cwd(),
          "public/uploads",
          heroImageName,
        );
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
      }
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
      sidebarLinks:
        typeof sidebarLinks === "string"
          ? JSON.parse(sidebarLinks)
          : sidebarLinks || [],
    };

    // Editor Flow
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: Page,
        targetId: id,
        action: "UPDATE",
        payload: { ...updatedData, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      await page.update({ is_locked: true, lock_ticket: result.notrans });
      return res.status(202).json({
        message: "Revisi halaman dikirim .",
        ticket: result.notrans,
      });
    }

    // Superadmin Flow / Local Draft
    if (oldHeroToDelete && (userRole === "superadmin" || status === "Draft")) {
      deleteSingleFile(oldHeroToDelete); // Hanya hapus file lama jika benar-benar commit
    }

    await page.update({
      ...updatedData,
      status: status || page.status,
      is_locked: false,
      lock_ticket: null,
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
    const userRole = req.userRole?.toLowerCase();

    const page = await Page.findByPk(id);
    if (!page) return res.status(404).json({ message: "Page not found" });

    // Check Lock
    if (page.is_locked) {
      return res.status(423).json({
        message: "Halaman terkunci oleh proses approval.",
        ticket: page.lock_ticket,
      });
    }

    // Editor Flow
    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: Page,
        targetId: id,
        action: "DELETE",
        payload: { title: page.title },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });
      await page.update({ is_locked: true, lock_ticket: result.notrans });
      return res.status(202).json({
        message: "Permintaan hapus dikirim . Data dikunci.",
        ticket: result.notrans,
      });
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
    res
      .status(500)
      .json({ message: "Failed to delete page", error: error.message });
  }
};
