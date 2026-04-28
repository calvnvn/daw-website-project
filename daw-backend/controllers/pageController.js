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
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "PAGE";
const NOTRANS_PREFIX = "PAGE";

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
    const existingLive = await Page.findOne({ where: whereClause });

    const existingDraft = await ApprovalDraft.findOne({
      where: {
        module_name: MODULE_NAME,
        status: "Pending",
        [Op.and]: sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(payload, '$.slug')) = '${finalSlug}'`,
        ),
      },
    });

    if (!existingLive && !existingDraft) break;

    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  return finalSlug;
};

exports.getAllPages = async (req, res) => {
  try {
    const pages = await Page.findAll({
      order: [["createdAt", "DESC"]],
      attributes: [
        "id",
        "title",
        "slug",
        "is_locked",
        "lock_ticket",
        [
          sequelize.literal(`(
            SELECT COUNT(*) > 0 
            FROM ApprovalDrafts 
            WHERE ApprovalDrafts.target_id = Page.id COLLATE utf8mb4_unicode_ci 
            AND ApprovalDrafts.module_name = '${MODULE_NAME}' 
            AND ApprovalDrafts.status = 'Rejected'
          )`),
          "hasRejected",
        ],
      ],
    });

    const formattedPages = pages.map((page) => {
      const p = page.toJSON();
      p.hasRejected = !!p.hasRejected;
      return p;
    });

    res.status(200).json(formattedPages);
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
  const t = await sequelize.transaction();
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

    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const userRole = req.userRole?.toLowerCase();

    const finalSlug = await generateUniqueSlug(title, slug);
    const sanitizedContent = dompurify.sanitize(content);
    const finalMetaDesc =
      metaDescription || stripHtml(sanitizedContent).substring(0, 150);
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

    // PRE-INSERT: Dapatkan UUID dengan status aman
    const isPublishing = userRole === "editor" && status === "Published";
    newPage = await Page.create(
      {
        ...pageData,
        status: isPublishing ? "Draft" : status || "Draft",
        is_locked: isPublishing,
      },
      { transaction: t },
    );

    // EDITOR PATH: BATON PASS (CREATE)
    if (isPublishing) {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          {
            where: { notrans: previous_notrans, module_name: MODULE_NAME },
            transaction: t,
          },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(newPage.id),
          action: "CREATE",
          payload: { ...pageData, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await newPage.update({ lock_ticket: notrans }, { transaction: t });
      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error(
          `🚨 [ERP SYNC FAILED] CREATE Page Ticket ${notrans}:`,
          owlError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan pembuatan halaman dikirim. Data dikunci.",
        ticket: notrans,
      });
    }

    // ADMIN PATH / SAVE DRAFT
    await t.commit();
    res.status(201).json({
      success: true,
      message: "Page created successfully",
      page: newPage,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({
      success: false,
      message: "Failed to create page",
      error: error.message,
    });
  }
};

exports.updatePage = async (req, res) => {
  const t = await sequelize.transaction();
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

    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const userRole = req.userRole?.toLowerCase();

    // FETCH & ROW-LEVEL LOCK
    const page = await Page.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!page) throw new Error("Page not found");

    if (page.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message: "Halaman terkunci.",
        ticket: page.lock_ticket,
      });
    }

    const finalSlug = await generateUniqueSlug(title, slug, id);
    const sanitizedContent = dompurify.sanitize(content);
    const finalMetaDesc =
      metaDescription || stripHtml(sanitizedContent).substring(0, 150);

    let heroImageName = page.heroImage;
    let oldHeroToDelete = null;

    if (req.file) {
      oldHeroToDelete = page.heroImage;
      heroImageName = req.file.filename;

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

    // EDITOR PATH: BATON PASS (UPDATE)
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);
      const ticketToClear = previous_notrans || page.lock_ticket;

      if (ticketToClear) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          {
            where: { notrans: ticketToClear, module_name: MODULE_NAME },
            transaction: t,
          },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(id),
          action: "UPDATE",
          payload: { ...updatedData, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await page.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );
      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error(
          `🚨 [ERP SYNC FAILED] UPDATE Page Ticket ${notrans}:`,
          owlError.message,
        );
      }

      return res
        .status(202)
        .json({ success: true, message: "Revisi dikirim.", ticket: notrans });
    }

    // ADMIN PATH: DIRECT COMMIT
    await ApprovalDraft.update(
      { status: "Obsolete" },
      {
        where: {
          module_name: MODULE_NAME,
          target_id: String(id),
          status: ["Pending", "Rejected"],
        },
        transaction: t,
      },
    );

    await page.update(
      {
        ...updatedData,
        status: status || page.status,
        is_locked: false,
        lock_ticket: null,
      },
      { transaction: t },
    );

    await t.commit();

    if (oldHeroToDelete && (userRole === "superadmin" || status === "Draft")) {
      deleteSingleFile(oldHeroToDelete);
    }

    res
      .status(200)
      .json({ success: true, message: "Page updated successfully" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({
      success: false,
      message: "Failed to update page",
      error: error.message,
    });
  }
};

exports.deletePage = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const userRole = req.userRole?.toLowerCase();

    const page = await Page.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!page) throw new Error("Page not found");

    if (page.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message: "Halaman terkunci.",
        ticket: page.lock_ticket,
      });
    }

    // EDITOR PATH: BATON PASS (DELETE)
    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      await ApprovalDraft.update(
        { status: "Obsolete" },
        {
          where: {
            module_name: MODULE_NAME,
            target_id: String(id),
            status: ["Pending", "Rejected"],
          },
          transaction: t,
        },
      );

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(id),
          action: "DELETE",
          payload: { title: page.title }, // Payload minimalis untuk DELETE
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await page.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );
      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error(
          `🚨 [ERP SYNC FAILED] DELETE Page Ticket ${notrans}:`,
          owlError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus dikirim.",
        ticket: notrans,
      });
    }

    // ADMIN PATH: HARD DELETE
    const heroImage = page.heroImage;
    const content = page.content;

    await page.destroy({ transaction: t });
    await t.commit();

    // Eksekusi pembersihan file fisik setelah DB commit (Anti-corruption)
    if (heroImage) deleteSingleFile(heroImage);
    if (content) {
      const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        deleteSingleFile(match[1]);
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Page deleted successfully" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({
      success: false,
      message: "Failed to delete page",
      error: error.message,
    });
  }
};
