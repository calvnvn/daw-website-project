const Project = require("../models/Project");
const BusinessSection = require("../models/BusinessSection");
const Translation = require("../models/Translation");
const { deleteSingleFile } = require("../utils/fileRemover");
const { autoTranslate } = require("./openaiService");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const {
  extractImagesFromHtml,
  generateUniqueSlug,
  handleEditorStaging,
} = require("../utils/editorHelper");
const { saveManualTranslations } = require("../utils/translationHelper");

const MODULE_NAME = "Project";

class ProjectService {
  /**
   * Background Translation Worker
   */
  async triggerBackgroundTranslation(projectId, payload) {
    try {
      const { title, excerpt, content, _translations } = payload;

      let manualTransObj = _translations;
      if (typeof manualTransObj === "string") {
        try {
          manualTransObj = JSON.parse(manualTransObj);
        } catch (e) {
          manualTransObj = {};
        }
      }
      const manualTrans = manualTransObj?.id || {};

      const safeTranslateBG = async (field, sourceValue) => {
        // Skip background auto-translate if the user manually input a translation for this field
        if (manualTrans[field] && String(manualTrans[field]).trim() !== "") {
          return;
        }

        let transRecord = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(projectId), field, locale: "id" } });
        if (!sourceValue || !String(sourceValue).trim()) {
           if (transRecord) await transRecord.destroy();
           return;
        }
        const fresh = await autoTranslate(sourceValue, "Indonesian");
        if (fresh) {
           if (transRecord) await transRecord.update({ translatedText: fresh });
           else await Translation.create({ modelName: MODULE_NAME, recordId: String(projectId), field, locale: "id", translatedText: fresh });
        }
      };

      if (title !== undefined) await safeTranslateBG("title", title);
      if (excerpt !== undefined) await safeTranslateBG("excerpt", excerpt);
      if (content !== undefined) await safeTranslateBG("content", content);
    } catch (error) {
      console.error("🚨 Background Translation Error:", error);
    }
  }

  /**
   * Consolidates payload parsing, image diffing (for cleanup), and slug generation.
   */
  async processProjectPayload(body, files, user, project) {
    const {
      title,
      slug,
      excerpt,
      content,
      category,
      status,
      existing_gallery,
      seo_title,
      meta_description,
      author,
    } = body;

    const authorIdentity = author || project.author || user.actorId || "System Admin";

    let finalGallery = [];
    let filesToDelete = [];
    let coverImageName = project?.cover_image || null;
    let oldCoverToDelete = null;

    const cleanContent = content ?? project.content ?? "";

    if (project.content) {
      const oldHtmlImages = extractImagesFromHtml(project.content);
      const newHtmlImages = extractImagesFromHtml(cleanContent);
      const deletedHtmlImages = oldHtmlImages.filter((img) => !newHtmlImages.includes(img));
      filesToDelete = [...filesToDelete, ...deletedHtmlImages];
    }

    if (existing_gallery) {
      try {
        const remainingGallery = typeof existing_gallery === "string" ? JSON.parse(existing_gallery) : existing_gallery;
        const oldGallery = typeof project.gallery === "string" ? JSON.parse(project.gallery || "[]") : project.gallery;
        const removedFromGallery = oldGallery.filter((file) => !remainingGallery.includes(file));
        filesToDelete = [...filesToDelete, ...removedFromGallery];
        finalGallery = remainingGallery;
      } catch (e) {
        console.error("Gagal parse gallery lama:", e);
      }
    }

    if (files && files["gallery"]) {
      const newImages = files["gallery"].map((file) => file.filename);
      finalGallery = [...finalGallery, ...newImages];
    }

    if (files && files["cover_image"]) {
      oldCoverToDelete = project.cover_image;
      coverImageName = files["cover_image"][0].filename;
    }

    let finalSlug = project.slug;
    if (slug && slug !== project.slug) {
      finalSlug = await generateUniqueSlug(Project, MODULE_NAME, slug, project.id);
    } else if (title && title !== project.title) {
      finalSlug = await generateUniqueSlug(Project, MODULE_NAME, title, project.id);
    }

    const allFilesToTrash = [...filesToDelete];
    if (oldCoverToDelete) allFilesToTrash.push(oldCoverToDelete);

    return {
      payload: {
        title: title ?? project.title,
        slug: finalSlug,
        excerpt: excerpt ?? project.excerpt,
        content: cleanContent,
        category: category ?? project.category,
        status: status ?? project.status,
        cover_image: coverImageName,
        gallery: finalGallery,
        seo_title: seo_title ?? project.seo_title,
        meta_description: meta_description ?? project.meta_description,
        author: authorIdentity,
        _filesToDelete: allFilesToTrash,
      },
      filesToDelete,
      oldCoverToDelete,
    };
  }

  // ─── ADMIN ENDPOINTS ───

  async getAllProjects() {
    const projects = await Project.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM ApprovalDrafts AS ad
              WHERE ad.target_id = Project.id
                AND ad.status = 'Rejected'
                AND ad.module_name = '${MODULE_NAME}'
            )`),
            "has_rejected_count",
          ],
        ],
      },
      include: [{ model: BusinessSection, as: "sectorData", attributes: ["category"] }],
      order: [["createdAt", "DESC"]],
    });

    return projects.map((p) => {
      const data = p.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });
  }

  async getProjectById(id) {
    const project = await Project.findByPk(id, {
      include: [{ model: BusinessSection, as: "sectorData", attributes: ["category"] }],
    });
    if (!project) throw new Error("NOT_FOUND: Project not found");
    return project;
  }

  async createProject({ req, res, body, files, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { previous_notrans, status: requestStatus } = body;
      const normalizedRole = userRole?.toLowerCase();

      const { payload } = await this.processProjectPayload(
        body,
        files,
        { actorId },
        { title: "", slug: "", gallery: [], cover_image: null }
      );

      if (normalizedRole === "editor" && requestStatus === "Published") {
        const newProject = await Project.create(
          { ...payload, status: "Draft", is_locked: true },
          { transaction: t }
        );

        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: "Projects",
          action: "CREATE",
          targetId: newProject.id,
          payload: { ...payload, status: "Published", _translations: body._translations },
          recordToLock: newProject,
          previousNotrans: previous_notrans,
          successMessage: "Proyek baru diajukan. Data dikunci menunggu persetujuan.",
          onSuccessCallback: (id, payload) => this.triggerBackgroundTranslation(id, payload),
        });
      }

      const finalStatus = requestStatus === "Published" ? "Published" : "Draft";
      const newProject = await Project.create(
        { ...payload, status: finalStatus, is_locked: false },
        { transaction: t }
      );

      await saveManualTranslations("Project", newProject.id, body._translations, t);
      await t.commit();
      this.triggerBackgroundTranslation(newProject.id, { ...payload, _translations: body._translations });

      return res.status(201).json({
        success: true,
        message: finalStatus === "Draft" ? "Draf proyek berhasil disimpan lokal." : "Proyek berhasil dipublikasikan.",
        data: newProject,
      });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateProject({ req, res, id, body, files, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase();
      const { status, previous_notrans } = body;

      const project = await Project.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!project) {
        await t.rollback();
        throw new Error("NOT_FOUND: Project not found");
      }

      if (project.is_locked) {
        if (normalizedRole === "editor") {
          await t.rollback();
          throw new Error(`LOCKED: tiket ${project.lock_ticket}`);
        }
      }

      // Populate translations if not provided (e.g. on partial updates / status toggle)
      if (!body._translations) {
        const existingTrans = await Translation.findAll({
          where: {
            modelName: MODULE_NAME,
            recordId: String(id),
          },
          transaction: t,
        });
        if (existingTrans.length > 0) {
          const transMap = { id: {} };
          existingTrans.forEach((t) => {
            if (t.locale === "id") {
              transMap.id[t.field] = t.translatedText;
            }
          });
          body._translations = transMap;
        }
      }

      const { payload, filesToDelete, oldCoverToDelete } = await this.processProjectPayload(
        body,
        files,
        { actorId },
        project
      );

      if (normalizedRole === "editor" && status === "Published") {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: "Projects",
          action: "UPDATE",
          targetId: id,
          payload: { ...payload, status: "Published", _translations: body._translations },
          recordToLock: project,
          previousNotrans: previous_notrans,
          successMessage: "Revisi diajukan. Data asli dikunci.",
          onSuccessCallback: (id, payload) => this.triggerBackgroundTranslation(id, payload),
        });
      }

      if (normalizedRole === "superadmin" || normalizedRole === "admin") {
        await invalidateOldDrafts(MODULE_NAME, id, t);
      }

      await project.update({ ...payload, is_locked: false, lock_ticket: null }, { transaction: t });
      await saveManualTranslations("Project", id, body._translations, t);
      await t.commit();

      this.triggerBackgroundTranslation(id, { ...payload, _translations: body._translations });

      if (normalizedRole === "superadmin" || (normalizedRole === "editor" && status === "Draft")) {
        filesToDelete.forEach((file) => deleteSingleFile(file));
        if (oldCoverToDelete) deleteSingleFile(oldCoverToDelete);
      }

      return res.status(200).json({ success: true, message: status === "Draft" ? "Draf disimpan." : "Override sukses." });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteProject({ req, res, id, userRole, actorId }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase();

      const project = await Project.findByPk(id, { transaction: t });
      if (!project) {
        await t.rollback();
        throw new Error("NOT_FOUND: Project not found");
      }

      if (project.is_locked && normalizedRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${project.lock_ticket}`);
      }

      if (normalizedRole === "editor") {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: "Projects",
          action: "DELETE",
          targetId: id,
          payload: { title: project.title, reason: "Request Delete" },
          recordToLock: project,
          successMessage: "Permintaan hapus dikirim.",
        });
      }

      await invalidateOldDrafts(MODULE_NAME, id, t);
      await project.destroy({ transaction: t });
      await Translation.destroy({ where: { modelName: MODULE_NAME, recordId: String(id) }, transaction: t });
      await t.commit();

      if (project.cover_image) deleteSingleFile(project.cover_image);
      const gallery = typeof project.gallery === "string" ? JSON.parse(project.gallery || "[]") : project.gallery;
      if (Array.isArray(gallery)) gallery.forEach((file) => deleteSingleFile(file));
      const contentImages = extractImagesFromHtml(project.content);
      contentImages.forEach((f) => deleteSingleFile(f));

      return res.status(200).json({ success: true, message: "Deleted permanently" });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  // ─── PUBLIC ENDPOINTS ───

  async getPublicProjects(lang = "en") {
    const projects = await Project.findAll({
      where: { status: "Published" },
      attributes: ["id", "title", "slug", "excerpt", "category", "cover_image"],
      order: [["createdAt", "DESC"]],
    });

    let finalProjects = projects.map((p) => p.get({ plain: true }));

    if (lang === "id" && finalProjects.length > 0) {
      const projectIds = finalProjects.map((p) => p.id);
      const translations = await Translation.findAll({
        where: {
          modelName: MODULE_NAME,
          recordId: { [Op.in]: projectIds },
          locale: "id",
        },
      });

      finalProjects.forEach((row) => {
        const titleTrans = translations.find((t) => t.recordId === String(row.id) && t.field === "title");
        const excerptTrans = translations.find((t) => t.recordId === String(row.id) && t.field === "excerpt");

        if (titleTrans) row.title = titleTrans.translatedText;
        if (excerptTrans) row.excerpt = excerptTrans.translatedText;
      });
    }

    return finalProjects;
  }

  async getPublicProjectById(id, lang = "en") {
    const project = await Project.findOne({
      where: { id, status: "Published" },
    });
    if (!project) throw new Error("NOT_FOUND: Project not found or not published");

    await project.increment("views", { by: 1, silent: true });
    const result = project.get({ plain: true });

    if (lang === "id") {
      const safeTranslate = async (moduleName, id, field, sourceValue) => {
        let transRecord = await Translation.findOne({ where: { modelName: moduleName, recordId: String(id), field, locale: "id" } });
        if (!sourceValue || !String(sourceValue).trim()) {
          if (transRecord) await transRecord.destroy();
          return sourceValue;
        }
        if (!transRecord) {
          const fresh = await autoTranslate(sourceValue, "Indonesian");
          if (fresh) await Translation.create({ modelName: moduleName, recordId: String(id), field, locale: "id", translatedText: fresh });
          return fresh || sourceValue;
        }
        return transRecord.translatedText;
      };

      result.title = await safeTranslate(MODULE_NAME, result.id, "title", result.title);
      result.excerpt = await safeTranslate(MODULE_NAME, result.id, "excerpt", result.excerpt);
      result.content = await safeTranslate(MODULE_NAME, result.id, "content", result.content);
    }

    return result;
  }

  async getPublicProjectBySlug(slug, lang = "en") {
    const project = await Project.findOne({
      where: { slug, status: "Published" },
      attributes: ["id", "title", "slug", "excerpt", "content", "category", "cover_image", "gallery", "author", "views", "createdAt", "updatedAt", "seo_title", "meta_description"],
      include: [{ model: BusinessSection, as: "sectorData", attributes: ["category"] }],
    });
    if (!project) throw new Error("NOT_FOUND: Project not found or not published");

    await project.increment("views", { by: 1, silent: true });
    const result = project.get({ plain: true });

    if (lang === "id") {
      const safeTranslate = async (moduleName, id, field, sourceValue) => {
        let transRecord = await Translation.findOne({ where: { modelName: moduleName, recordId: String(id), field, locale: "id" } });
        if (!sourceValue || !String(sourceValue).trim()) {
          if (transRecord) await transRecord.destroy();
          return sourceValue;
        }
        if (!transRecord) {
          const fresh = await autoTranslate(sourceValue, "Indonesian");
          if (fresh) await Translation.create({ modelName: moduleName, recordId: String(id), field, locale: "id", translatedText: fresh });
          return fresh || sourceValue;
        }
        return transRecord.translatedText;
      };

      result.title = await safeTranslate(MODULE_NAME, result.id, "title", result.title);
      result.excerpt = await safeTranslate(MODULE_NAME, result.id, "excerpt", result.excerpt);
      result.content = await safeTranslate(MODULE_NAME, result.id, "content", result.content);
    }

    return result;
  }

  async incrementProjectView(id) {
    const project = await Project.findByPk(id);
    if (project) {
      await project.increment("views", { by: 1, silent: true });
    }
  }
}

module.exports = new ProjectService();
