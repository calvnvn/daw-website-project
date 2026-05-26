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
const { generateUniqueSlug, handleEditorStaging } = require("../utils/editorHelper");

const MODULE_NAME = "PAGE";
const NOTRANS_PREFIX = "PAGE";

const stripHtml = (html) => html.replace(/<[^>]*>?/gm, "");

class PageService {
  async getAllPages() {
    const pages = await Page.findAll({
      order: [["createdAt", "DESC"]],
      attributes: [
        "id", "title", "slug", "is_locked", "lock_ticket",
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

    return pages.map((page) => {
      const p = page.toJSON();
      p.hasRejected = !!p.hasRejected;
      return p;
    });
  }

  async getPageBySlug(slug) {
    const page = await Page.findOne({ where: { slug } });
    if (!page) throw new Error("NOT_FOUND: Page not found");
    return page;
  }

  async createPage({ req, res, userRole, body, file, actorId }) {
    const t = await sequelize.transaction();
    try {
      const { title, slug, subtitle, templateType, content, metaDescription, showDropCap, sidebarLinks, status, previous_notrans } = body;

      const finalSlug = await generateUniqueSlug(Page, MODULE_NAME, slug || title);
      const sanitizedContent = dompurify.sanitize(content);
      const finalMetaDesc = metaDescription || stripHtml(sanitizedContent).substring(0, 150);
      const heroImageName = file ? file.filename : null;

      const pageData = {
        title, slug: finalSlug, subtitle, heroImage: heroImageName,
        templateType: templateType || "split", content: sanitizedContent,
        metaDescription: finalMetaDesc, showDropCap: showDropCap === "true",
        sidebarLinks: typeof sidebarLinks === "string" ? JSON.parse(sidebarLinks) : sidebarLinks || [],
      };

      const isPublishing = userRole === "editor" && status === "Published";
      const newPage = await Page.create(
        { ...pageData, status: isPublishing ? "Draft" : status || "Draft", is_locked: isPublishing },
        { transaction: t }
      );

      if (isPublishing) {
        return handleEditorStaging({
          req, res, t, moduleName: MODULE_NAME, notransPrefix: NOTRANS_PREFIX, action: "CREATE",
          targetId: newPage.id, payload: { ...pageData, status: "Published" }, recordToLock: newPage,
          previousNotrans: previous_notrans, successMessage: "Permintaan pembuatan halaman dikirim. Data dikunci.",
        });
      }

      await t.commit();
      return res.status(201).json({ success: true, message: "Page created successfully", page: newPage });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updatePage({ req, res, id, userRole, body, file, actorId }) {
    const t = await sequelize.transaction();
    try {
      const { title, slug, subtitle, templateType, content, metaDescription, showDropCap, sidebarLinks, status, previous_notrans } = body;

      const page = await Page.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!page) {
        await t.rollback();
        throw new Error("NOT_FOUND: Page not found");
      }

      if (page.is_locked && userRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${page.lock_ticket}`);
      }

      const finalSlug = await generateUniqueSlug(Page, MODULE_NAME, slug || title, id);
      const sanitizedContent = dompurify.sanitize(content);
      const finalMetaDesc = metaDescription || stripHtml(sanitizedContent).substring(0, 150);

      let heroImageName = page.heroImage;
      let oldHeroToDelete = null;

      if (file) {
        oldHeroToDelete = page.heroImage;
        heroImageName = file.filename;

        if (userRole === "editor" && status === "Published") {
          const oldPath = path.join(process.cwd(), "public/uploads", heroImageName);
          heroImageName = `TEMP_${heroImageName}`;
          const newPath = path.join(process.cwd(), "public/uploads", heroImageName);
          if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
        }
      }

      const updatedData = {
        title, slug: finalSlug, subtitle, heroImage: heroImageName,
        templateType: templateType || "split", content: sanitizedContent,
        metaDescription: finalMetaDesc, showDropCap: showDropCap === "true",
        sidebarLinks: typeof sidebarLinks === "string" ? JSON.parse(sidebarLinks) : sidebarLinks || [],
      };

      if (userRole === "editor" && status === "Published") {
        const ticketToClear = previous_notrans || page.lock_ticket;
        return handleEditorStaging({
          req, res, t, moduleName: MODULE_NAME, notransPrefix: NOTRANS_PREFIX, action: "UPDATE",
          targetId: id, payload: { ...updatedData, status: "Published" }, recordToLock: page,
          previousNotrans: ticketToClear, successMessage: "Revisi dikirim.",
        });
      }

      await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, target_id: String(id), status: ["Pending", "Rejected"] }, transaction: t });
      await page.update({ ...updatedData, status: status || page.status, is_locked: false, lock_ticket: null }, { transaction: t });
      await t.commit();

      if (oldHeroToDelete && (userRole === "superadmin" || status === "Draft")) {
        deleteSingleFile(oldHeroToDelete);
      }

      return res.status(200).json({ success: true, message: "Page updated successfully" });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deletePage({ req, res, id, userRole, actorId }) {
    const t = await sequelize.transaction();
    try {
      const page = await Page.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!page) {
        await t.rollback();
        throw new Error("NOT_FOUND: Page not found");
      }

      if (page.is_locked && userRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${page.lock_ticket}`);
      }

      if (userRole === "editor") {
        await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, target_id: String(id), status: ["Pending", "Rejected"] }, transaction: t });

        return handleEditorStaging({
          req, res, t, moduleName: MODULE_NAME, notransPrefix: NOTRANS_PREFIX, action: "DELETE",
          targetId: id, payload: { title: page.title }, recordToLock: page, successMessage: "Permintaan hapus dikirim.",
        });
      }

      const heroImage = page.heroImage;
      const content = page.content;

      await page.destroy({ transaction: t });
      await t.commit();

      if (heroImage) deleteSingleFile(heroImage);
      if (content) {
        const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
          deleteSingleFile(match[1]);
        }
      }

      return res.status(200).json({ success: true, message: "Page deleted successfully" });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new PageService();
