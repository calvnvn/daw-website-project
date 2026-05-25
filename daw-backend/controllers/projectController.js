const Project = require("../models/Project");
const BusinessSection = require("../models/BusinessSection");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { deleteSingleFile } = require("../utils/fileRemover");
const { autoTranslate } = require("../services/openaiService");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;
const MODULE_NAME = "Project";

// ─── BACKGROUND TRANSLATION WORKER ─────────────────────────────────────
const triggerBackgroundTranslation = async (projectId, payload) => {
  try {
    const { title, excerpt, content } = payload;
    
    // Process heavy translations asynchronously (Non-blocking)
    const idTitle = title ? await autoTranslate(title, "Indonesian") : null;
    const idExcerpt = excerpt ? await autoTranslate(excerpt, "Indonesian") : null;
    const idContent = content ? await autoTranslate(content, "Indonesian") : null;

    const upsertTranslation = async (field, translatedText) => {
      if (!translatedText) return;
      const existing = await Translation.findOne({
        where: { modelName: MODULE_NAME, recordId: projectId, field, locale: "id" }
      });
      if (existing) {
        await existing.update({ translatedText });
      } else {
        await Translation.create({
          modelName: MODULE_NAME, recordId: projectId, field, locale: "id", translatedText
        });
      }
    };

    // Save outputs to centralized Translation table
    await upsertTranslation("title", idTitle);
    await upsertTranslation("excerpt", idExcerpt);
    await upsertTranslation("content", idContent);
  } catch (error) {
    console.error("🚨 Background Translation Error:", error);
  }
};

// Utility: Parses HTML content to identify and collect uploaded image paths for subsequent garbage collection.
const extractImagesFromHtml = (html) => {
  if (!html) return [];
  const images = [];
  const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    images.push(match[1]);
  }
  return images;
};

// Orchestrates the generation of a unique URL slug, checking both live production data and pending ERP drafts to prevent collisions.
const generateUniqueProjectSlug = async (title, id = null) => {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  let finalSlug = baseSlug;
  let counter = 1;

  while (true) {
    const whereClause = id
      ? { slug: finalSlug, id: { [Op.ne]: id } }
      : { slug: finalSlug };
    const existingLive = await Project.findOne({ where: whereClause });

    const existingDraft = await ApprovalDraft.findOne({
      where: {
        module_name: "Project",
        status: "Pending",
        "payload.slug": finalSlug,
      },
    });

    if (!existingLive && !existingDraft) break;

    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  return finalSlug;
};

// Consolidates payload parsing, image diffing (for cleanup), and slug generation to keep the main controller logic clean.
const processProjectPayload = async (req, project) => {
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
  } = req.body;

  // Resolves the definitive author identity, prioritizing admin input, then existing record, then current user context.
  const authorIdentity =
    author ||
    project.author ||
    req.owl_username ||
    req.karyawanId ||
    "System Admin";

  let finalGallery = [];
  let filesToDelete = [];
  let coverImageName = project?.cover_image || null;
  let oldCoverToDelete = null;

  const cleanContent = content ?? project.content ?? "";

  // Compares previous vs. incoming HTML content to flag removed images for deletion.
  if (project.content) {
    const oldHtmlImages = extractImagesFromHtml(project.content);
    const newHtmlImages = extractImagesFromHtml(cleanContent);
    const deletedHtmlImages = oldHtmlImages.filter(
      (img) => !newHtmlImages.includes(img),
    );
    filesToDelete = [...filesToDelete, ...deletedHtmlImages];
  }

  // Merges retained legacy gallery images with newly uploaded assets.
  if (existing_gallery) {
    try {
      const remainingGallery =
        typeof existing_gallery === "string"
          ? JSON.parse(existing_gallery)
          : existing_gallery;
      const oldGallery =
        typeof project.gallery === "string"
          ? JSON.parse(project.gallery || "[]")
          : project.gallery;

      const removedFromGallery = oldGallery.filter(
        (file) => !remainingGallery.includes(file),
      );
      filesToDelete = [...filesToDelete, ...removedFromGallery];
      finalGallery = remainingGallery;
    } catch (e) {
      console.error("Gagal parse gallery lama:", e);
    }
  }

  if (req.files && req.files["gallery"]) {
    const newImages = req.files["gallery"].map((file) => file.filename);
    finalGallery = [...finalGallery, ...newImages];
  }

  // Stages old cover image for deletion if a replacement is provided.
  if (req.files && req.files["cover_image"]) {
    oldCoverToDelete = project.cover_image;
    coverImageName = req.files["cover_image"][0].filename;
  }

  let finalSlug = project.slug;
  if (slug && slug !== project.slug) {
    finalSlug = await generateUniqueProjectSlug(slug, project.id);
  } else if (title && title !== project.title) {
    finalSlug = await generateUniqueProjectSlug(title, project.id);
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
};

// Retrieves all projects for the admin dashboard, appending a dynamic rejection flag via a raw SQL subquery.
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM ApprovalDrafts AS ad
              WHERE ad.target_id = Project.id
                AND ad.status = 'Rejected'
                AND ad.module_name = 'Project'
            )`),
            "has_rejected_count",
          ],
        ],
      },
      include: [
        { model: BusinessSection, as: "sectorData", attributes: ["category"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    const result = projects.map((p) => {
      const data = p.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetches a specific project by ID for the admin editor interface.
exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: BusinessSection, as: "sectorData", attributes: ["category"] },
      ],
    });

    if (!project) return res.status(404).json({ message: "Project not found" });
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Initializes a new project record, routing the operation based on the user's role and publication intent.
exports.createProject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { previous_notrans, status: requestStatus } = req.body;
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

    const { payload } = await processProjectPayload(req, {
      title: "",
      slug: "",
      gallery: [],
      cover_image: null,
    });

    // Branch A: Editor initiates a publication request, locking the new record and syncing with ERP.
    if (userRole === "editor" && requestStatus === "Published") {
      const notrans = await generateNotrans("Projects");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      const newProject = await Project.create(
        { ...payload, status: "Draft", is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Project",
          action: "CREATE",
          target_id: String(newProject.id),
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();

      // Trigger AI translation in background (Non-blocking)
      triggerBackgroundTranslation(newProject.id, payload);

      return res.status(202).json({
        message: "Proyek baru diajukan. Data dikunci menunggu persetujuan.",
        ticket: notrans,
      });
    }

    // Branch B: Admin publishes directly, or Editor explicitly saves as a local Draft without ERP involvement.
    const finalStatus = requestStatus === "Published" ? "Published" : "Draft";
    const newProject = await Project.create(
      { ...payload, status: finalStatus, is_locked: false },
      { transaction: t },
    );

    await t.commit();

    // Trigger AI translation in background (Non-blocking)
    triggerBackgroundTranslation(newProject.id, payload);

    return res.status(201).json({
      message:
        finalStatus === "Draft"
          ? "Draf proyek berhasil disimpan lokal."
          : "Proyek berhasil dipublikasikan.",
      data: newProject,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 Error CREATE Project:", error);
    res
      .status(500)
      .json({ message: "Gagal membuat proyek baru.", error: error.message });
  }
};

// Modifies an existing project, handling pessimistic locks and staging logic for Editors versus direct commits for Admins.
exports.updateProject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const { status, previous_notrans } = req.body;
    const actorId = String(req.owl_username || req.karyawanId);

    const project = await Project.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!project) {
      await t.rollback();
      return res.status(404).json({ message: "Project not found" });
    }

    // Enforces concurrency control, preventing Editors from modifying actively reviewed records. Admins bypass this.
    if (project.is_locked) {
      if (userRole === "editor") {
        await t.rollback();
        return res.status(423).json({
          message: "Data sedang dikunci oleh proses approval.",
          ticket: project.lock_ticket,
        });
      }
      console.log(`>>> [OVERRIDE] Admin bypass lock pada Proyek ID: ${id}`);
    }

    const { payload, filesToDelete, oldCoverToDelete } =
      await processProjectPayload(req, project);

    // Branch A: Editor requests publication of changes, staging them in the Vault and notifying the ERP.
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans("Projects");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Project",
          action: "UPDATE",
          target_id: String(id),
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await project.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();

      // Trigger AI translation in background (Non-blocking)
      triggerBackgroundTranslation(id, payload);

      return res.status(202).json({
        message: "Revisi diajukan. Data asli dikunci.",
        ticket: notrans,
      });
    }

    // Branch B: Admin executes a live update, automatically invalidating any conflicting legacy drafts.
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts("Project", id, t);
    }

    await project.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );
    await t.commit();

    // Trigger AI translation in background (Non-blocking)
    triggerBackgroundTranslation(id, payload);

    // Safely purges physical files only after the database transaction succeeds.
    if (
      userRole === "superadmin" ||
      (userRole === "editor" && status === "Draft")
    ) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
      if (oldCoverToDelete) deleteSingleFile(oldCoverToDelete);
    }

    res.status(200).json({
      message: status === "Draft" ? "Draf disimpan." : "Override sukses.",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 ERROR UPDATE PROJECT:", error);
    res.status(500).json({ message: error.message });
  }
};

// Manages the deletion lifecycle, routing Editors through ERP approval while allowing Admins to perform immediate, cascading physical deletes.
exports.deleteProject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

    const project = await Project.findByPk(id, { transaction: t });

    if (!project) {
      await t.rollback();
      return res.status(404).json({ message: "Project not found" });
    }

    if (project.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Data terkunci karena sedang dalam proses approval.",
        ticket: project.lock_ticket,
      });
    }

    // Branch A: Editor stages a deletion request, locking the record without actually destroying it.
    if (userRole === "editor") {
      const notrans = await generateNotrans("Projects");

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Project",
          action: "DELETE",
          target_id: String(id),
          payload: { title: project.title, reason: "Request Delete" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await project.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();
      return res
        .status(202)
        .json({ message: "Permintaan hapus dikirim.", ticket: notrans });
    }

    // Branch B: Admin performs a hard delete, triggering physical file cleanup for cover images and gallery assets.
    await invalidateOldDrafts("Project", id, t);
    await project.destroy({ transaction: t });
    await t.commit();

    if (project.cover_image) deleteSingleFile(project.cover_image);
    const gallery =
      typeof project.gallery === "string"
        ? JSON.parse(project.gallery || "[]")
        : project.gallery;
    if (Array.isArray(gallery))
      gallery.forEach((file) => deleteSingleFile(file));

    res.status(200).json({ message: "Deleted permanently" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// PUBLIC READ-ONLY ENDPOINTS

// Facilitates asynchronous image uploads from the rich text editor before standard form submission.
exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No image file provided." });
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res
      .status(200)
      .json({ message: "Image uploaded succesfully", url: fileUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Serves the public project gallery, filtering strictly for 'Published' records.
exports.getPublicProjects = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const projects = await Project.findAll({
      where: { status: "Published" },
      attributes: ["id", "title", "slug", "excerpt", "category", "cover_image"],
      order: [["createdAt", "DESC"]],
    });

    let finalProjects = projects.map((p) => p.get({ plain: true }));

    // ─── BULK MERGE TRANSLATIONS (IF INDONESIAN) ───
    if (lang === "id" && finalProjects.length > 0) {
      const projectIds = finalProjects.map((p) => p.id);
      const translations = await Translation.findAll({
        where: {
          modelName: MODULE_NAME,
          recordId: { [Op.in]: projectIds },
          locale: "id"
        }
      });
      
      finalProjects.forEach((row) => {
        const titleTrans = translations.find((t) => t.recordId === row.id && t.field === "title");
        const excerptTrans = translations.find((t) => t.recordId === row.id && t.field === "excerpt");
        
        // Overwrite standard English text with localized text
        if (titleTrans) row.title = titleTrans.translatedText;
        if (excerptTrans) row.excerpt = excerptTrans.translatedText;
      });
    }

    res.status(200).json(finalProjects);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch public projects.",
      error: error.message,
    });
  }
};

// Retrieves project details for viewing by internal ID, silently incrementing view counts.
exports.getPublicProjectById = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const project = await Project.findOne({
      where: { id: req.params.id, status: "Published" },
    });
    if (!project)
      return res
        .status(404)
        .json({ message: "Project not found or not published" });

    await project.increment("views", { by: 1, silent: true });

    const result = project.get({ plain: true });

    // ─── LAZY ON-DEMAND TRANSLATION LOGIC ───
    if (lang === "id") {
      let titleTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: result.id, field: "title", locale: "id" } });
      let excerptTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: result.id, field: "excerpt", locale: "id" } });
      let contentTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: result.id, field: "content", locale: "id" } });

      if (!titleTrans || !contentTrans) {
        console.log(`[Lazy Translation] Translating older project ID: ${result.id}...`);
        const freshTitle = await autoTranslate(result.title, "Indonesian");
        const freshExcerpt = await autoTranslate(result.excerpt, "Indonesian");
        const freshContent = await autoTranslate(result.content, "Indonesian");

        const upsertTranslation = async (field, translatedText) => {
          if (!translatedText) return;
          const existing = await Translation.findOne({
            where: { modelName: MODULE_NAME, recordId: result.id, field, locale: "id" }
          });
          if (existing) {
            await existing.update({ translatedText });
          } else {
            await Translation.create({
              modelName: MODULE_NAME, recordId: result.id, field, locale: "id", translatedText
            });
          }
        };

        if (freshTitle) {
          await upsertTranslation("title", freshTitle);
          result.title = freshTitle;
        }
        if (freshExcerpt) {
          await upsertTranslation("excerpt", freshExcerpt);
          result.excerpt = freshExcerpt;
        }
        if (freshContent) {
          await upsertTranslation("content", freshContent);
          result.content = freshContent;
        }
      } else {
        if (titleTrans) result.title = titleTrans.translatedText;
        if (excerptTrans) result.excerpt = excerptTrans.translatedText;
        if (contentTrans) result.content = contentTrans.translatedText;
      }
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Retrieves project details for front-end routing by SEO-friendly slug, executing silent view tracking.
exports.getPublicProjectBySlug = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const project = await Project.findOne({
      where: { slug: req.params.slug, status: "Published" },
      attributes: [
        "id",
        "title",
        "slug",
        "excerpt",
        "content",
        "category",
        "cover_image",
        "gallery",
        "author",
        "views",
        "createdAt",
        "updatedAt",
        "seo_title",
        "meta_description",
      ],
      include: [
        {
          model: BusinessSection,
          as: "sectorData",
          attributes: ["category"],
        },
      ],
    });

    if (!project)
      return res
        .status(404)
        .json({ message: "Project not found or not published" });

    await project.increment("views", { by: 1, silent: true });

    const result = project.get({ plain: true });

    // ─── LAZY ON-DEMAND TRANSLATION LOGIC ───
    if (lang === "id") {
      let titleTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: result.id, field: "title", locale: "id" } });
      let excerptTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: result.id, field: "excerpt", locale: "id" } });
      let contentTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: result.id, field: "content", locale: "id" } });

      if (!titleTrans || !contentTrans) {
        console.log(`[Lazy Translation] Translating older project ID: ${result.id}...`);
        const freshTitle = await autoTranslate(result.title, "Indonesian");
        const freshExcerpt = await autoTranslate(result.excerpt, "Indonesian");
        const freshContent = await autoTranslate(result.content, "Indonesian");

        const upsertTranslation = async (field, translatedText) => {
          if (!translatedText) return;
          const existing = await Translation.findOne({
            where: { modelName: MODULE_NAME, recordId: result.id, field, locale: "id" }
          });
          if (existing) {
            await existing.update({ translatedText });
          } else {
            await Translation.create({
              modelName: MODULE_NAME, recordId: result.id, field, locale: "id", translatedText
            });
          }
        };

        if (freshTitle) {
          await upsertTranslation("title", freshTitle);
          result.title = freshTitle;
        }
        if (freshExcerpt) {
          await upsertTranslation("excerpt", freshExcerpt);
          result.excerpt = freshExcerpt;
        }
        if (freshContent) {
          await upsertTranslation("content", freshContent);
          result.content = freshContent;
        }
      } else {
        if (titleTrans) result.title = titleTrans.translatedText;
        if (excerptTrans) result.excerpt = excerptTrans.translatedText;
        if (contentTrans) result.content = contentTrans.translatedText;
      }
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Provides an isolated endpoint to manually increment view statistics without transmitting the full payload.
exports.incrementProjectView = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (project) {
      await project.increment("views", { by: 1, silent: true });
    }
    res.status(200).json({ message: "View incremented" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
