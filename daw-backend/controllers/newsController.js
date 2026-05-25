const NewsArticle = require("../models/NewsArticle");
const NewsCategory = require("../models/NewsCategory");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "NewsArticle";

// Utility: Calculates estimated reading time from HTML content using industry-standard 200 WPM.
const calculateReadTime = (htmlContent) => {
  if (!htmlContent) return "1 min read";
  const plainText = htmlContent
    .replace(/<[^>]*>?/gm, "")
    .replace(/&nbsp;|\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const minutes = Math.ceil(wordCount / 200);
  return `${Math.max(1, minutes)} min read`;
};

// Utility: Parses HTML content to identify uploaded image paths for garbage collection.
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

// Generates a unique URL slug, checking both live data and pending drafts to prevent collisions.
const generateUniqueNewsSlug = async (title, id = null) => {
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
    const existingLive = await NewsArticle.findOne({ where: whereClause });

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

// Consolidates payload parsing, image diffing, and slug generation.
const processNewsPayload = async (req, article) => {
  const {
    title,
    slug,
    excerpt,
    content,
    category_id,
    status,
    seo_title,
    meta_description,
    author,
    published_at,
    read_time,
    gallery_images,
  } = req.body;

  const authorIdentity =
    author ||
    article.author ||
    req.owl_username ||
    req.karyawanId ||
    "System Admin";

  let filesToDelete = [];
  let coverImageName = article?.cover_image || null;
  let oldCoverToDelete = null;

  const cleanContent = content ?? article.content ?? "";

  // Compare previous vs. incoming HTML to flag removed images for deletion.
  if (article.content) {
    const oldHtmlImages = extractImagesFromHtml(article.content);
    const newHtmlImages = extractImagesFromHtml(cleanContent);
    const deletedHtmlImages = oldHtmlImages.filter(
      (img) => !newHtmlImages.includes(img),
    );
    filesToDelete = [...filesToDelete, ...deletedHtmlImages];
  }

  // Stage old cover image for deletion if a replacement is provided.
  if (req.files && req.files["cover_image"]) {
    oldCoverToDelete = article.cover_image;
    coverImageName = req.files["cover_image"][0].filename;
  }

  let finalSlug = article.slug;
  if (slug && slug !== article.slug) {
    finalSlug = await generateUniqueNewsSlug(slug, article.id);
  } else if (title && title !== article.title) {
    finalSlug = await generateUniqueNewsSlug(title, article.id);
  }

  const allFilesToTrash = [...filesToDelete];
  if (oldCoverToDelete) allFilesToTrash.push(oldCoverToDelete);

  // Parse gallery_images if it's sent as a stringified JSON array from FormData
  let parsedGallery = article.gallery_images || null;
  if (gallery_images !== undefined) {
    if (typeof gallery_images === "string") {
      try {
        parsedGallery = JSON.parse(gallery_images);
      } catch (e) {
        console.warn("Failed to parse gallery_images JSON string:", e);
        parsedGallery = article.gallery_images || null;
      }
    } else {
      parsedGallery = gallery_images;
    }
  }

  return {
    payload: {
      title: title ?? article.title,
      slug: finalSlug,
      excerpt: excerpt ?? article.excerpt,
      content: cleanContent,
      category_id: category_id ?? article.category_id,
      status: status ?? article.status,
      cover_image: coverImageName,
      seo_title: seo_title ?? article.seo_title,
      meta_description: meta_description ?? article.meta_description,
      author: authorIdentity,
      published_at: published_at ?? article.published_at,
      read_time:
        read_time && read_time.trim()
          ? read_time.trim()
          : calculateReadTime(cleanContent),
      gallery_images: parsedGallery,
      _filesToDelete: allFilesToTrash,
    },
    filesToDelete,
    oldCoverToDelete,
  };
};

// ─── ADMIN ENDPOINTS ──────────────────────────────────────────────────

// Retrieves all articles for the admin dashboard with rejection flag subquery.
exports.getAllNews = async (req, res) => {
  try {
    const articles = await NewsArticle.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM ApprovalDrafts AS ad
              WHERE ad.target_id = NewsArticle.id
                AND ad.status = 'Rejected'
                AND ad.module_name = '${MODULE_NAME}'
            )`),
            "has_rejected_count",
          ],
        ],
      },
      include: [
        {
          model: NewsCategory,
          as: "categoryData",
          attributes: ["id", "name", "slug", "color"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const result = articles.map((a) => {
      const data = a.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("🚨 Error GET All News:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Fetches a specific article by ID for the admin editor.
exports.getNewsById = async (req, res) => {
  try {
    const article = await NewsArticle.findByPk(req.params.id, {
      include: [
        {
          model: NewsCategory,
          as: "categoryData",
          attributes: ["id", "name", "slug", "color"],
        },
      ],
    });

    if (!article) return res.status(404).json({ message: "Article not found" });
    res.status(200).json(article);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Creates a new article, routing based on user role and publication intent.
exports.createNews = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { previous_notrans, status: requestStatus } = req.body;
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

    const { payload } = await processNewsPayload(req, {
      title: "",
      slug: "",
      cover_image: null,
    });

    // Branch A: Editor requests publication → ERP approval flow
    if (userRole === "editor" && requestStatus === "Published") {
      const notrans = await generateNotrans("News");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      const newArticle = await NewsArticle.create(
        {
          ...payload,
          status: "Draft",
          is_locked: true,
          lock_ticket: notrans,
        },
        { transaction: t },
      );

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          action: "CREATE",
          target_id: String(newArticle.id),
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
      return res.status(202).json({
        message: "Artikel baru diajukan. Data dikunci menunggu persetujuan.",
        ticket: notrans,
      });
    }

    // Branch B: Admin publishes directly, or Editor saves as Draft.
    const finalStatus = requestStatus === "Published" ? "Published" : "Draft";
    const newArticle = await NewsArticle.create(
      { ...payload, status: finalStatus, is_locked: false },
      { transaction: t },
    );

    await t.commit();
    return res.status(201).json({
      message:
        finalStatus === "Draft"
          ? "Draf artikel berhasil disimpan."
          : "Artikel berhasil dipublikasikan.",
      data: newArticle,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 Error CREATE News:", error);
    res
      .status(500)
      .json({ message: "Gagal membuat artikel baru.", error: error.message });
  }
};

// Modifies an existing article with pessimistic locking and role bifurcation.
exports.updateNews = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const { status, previous_notrans } = req.body;
    const actorId = String(req.owl_username || req.karyawanId);

    const article = await NewsArticle.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!article) {
      await t.rollback();
      return res.status(404).json({ message: "Article not found" });
    }

    // Enforce concurrency control for Editors on locked records.
    if (article.is_locked) {
      if (userRole === "editor") {
        await t.rollback();
        return res.status(423).json({
          message: "Data sedang dikunci oleh proses approval.",
          ticket: article.lock_ticket,
        });
      }
      console.log(`>>> [OVERRIDE] Admin bypass lock pada News ID: ${id}`);
    }

    const { payload, filesToDelete, oldCoverToDelete } =
      await processNewsPayload(req, article);

    // Branch A: Editor requests publication → stage in vault + ERP notification.
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans("News");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          action: "UPDATE",
          target_id: String(id),
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await article.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ErpApprovalService.initiateApproval({
        notrans,
        karyawanId: actorId,
        token: req.owl_token,
      });

      await t.commit();
      return res.status(202).json({
        message: "Revisi diajukan. Data asli dikunci.",
        ticket: notrans,
      });
    }

    // Branch B: Admin executes live update, invalidating conflicting drafts.
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts(MODULE_NAME, id, t);
    }

    await article.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );
    await t.commit();

    // Purge physical files only after transaction success.
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
    console.error("🚨 ERROR UPDATE News:", error);
    res.status(500).json({ message: error.message });
  }
};

// Manages deletion lifecycle with Editor→ERP staging and Admin→hard delete.
exports.deleteNews = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

    const article = await NewsArticle.findByPk(id, { transaction: t });

    if (!article) {
      await t.rollback();
      return res.status(404).json({ message: "Article not found" });
    }

    if (article.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Data terkunci karena sedang dalam proses approval.",
        ticket: article.lock_ticket,
      });
    }

    // Branch A: Editor stages a deletion request.
    if (userRole === "editor") {
      const notrans = await generateNotrans("News");

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          action: "DELETE",
          target_id: String(id),
          payload: { title: article.title, reason: "Request Delete" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await article.update(
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

    // Branch B: Admin performs hard delete with physical file cleanup.
    await invalidateOldDrafts(MODULE_NAME, id, t);
    await article.destroy({ transaction: t });
    await t.commit();

    if (article.cover_image) deleteSingleFile(article.cover_image);

    // Clean up inline content images
    const contentImages = extractImagesFromHtml(article.content);
    contentImages.forEach((file) => deleteSingleFile(file));

    res.status(200).json({ message: "Artikel dihapus permanen." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};

// Facilitates async image uploads from the WYSIWYG editor.
exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "No image file provided." });
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    res
      .status(200)
      .json({ message: "Image uploaded successfully", url: fileUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── PUBLIC READ-ONLY ENDPOINTS ───────────────────────────────────────

// Serves the public news listing with pagination, search, and category filtering.
exports.getPublicNews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const category = req.query.category || "";
    const sortBy = req.query.sortBy || "latest";

    const whereClause = { status: "Published" };

    if (search) {
      whereClause.title = { [Op.like]: `%${search}%` };
    }

    if (category) {
      whereClause.category_id = category;
    }

    // Dynamic sorting with COALESCE fallback for null published_at
    let orderClause;
    if (sortBy === "oldest") {
      orderClause = [
        [
          sequelize.literal(
            "COALESCE(`NewsArticle`.`published_at`, `NewsArticle`.`createdAt`)",
          ),
          "ASC",
        ],
        ["id", "ASC"],
      ];
    } else if (sortBy === "popular") {
      orderClause = [
        ["views", "DESC"],
        [
          sequelize.literal(
            "COALESCE(`NewsArticle`.`published_at`, `NewsArticle`.`createdAt`)",
          ),
          "DESC",
        ],
        ["id", "DESC"],
      ];
    } else {
      // Default: latest — guarantees newest article is always first
      orderClause = [
        [
          sequelize.literal(
            "COALESCE(`NewsArticle`.`published_at`, `NewsArticle`.`createdAt`)",
          ),
          "DESC",
        ],
        ["id", "DESC"],
      ];
    }

    const { count, rows } = await NewsArticle.findAndCountAll({
      where: whereClause,
      attributes: [
        "id",
        "title",
        "slug",
        "excerpt",
        "category_id",
        "cover_image",
        "author",
        "published_at",
        "read_time",
        "views",
        "createdAt",
      ],
      include: [
        {
          model: NewsCategory,
          as: "categoryData",
          attributes: ["id", "name", "slug", "color"],
        },
      ],
      order: orderClause,
      limit,
      offset,
    });

    res.status(200).json({
      data: rows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("🚨 Error getPublicNews:", error.message);
    res.status(500).json({
      message: "Failed to fetch news articles.",
      error: error.message,
    });
  }
};

// Retrieves article details by slug for front-end (read-only, no automatic view increment).
exports.getPublicNewsBySlug = async (req, res) => {
  try {
    const article = await NewsArticle.findOne({
      where: { slug: req.params.slug, status: "Published" },
      include: [
        {
          model: NewsCategory,
          as: "categoryData",
          attributes: ["id", "name", "slug", "color"],
        },
      ],
    });

    if (!article)
      return res
        .status(404)
        .json({ message: "Article not found or not published" });

    res.status(200).json(article);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Increments the views count of a public news article on demand.
exports.incrementNewsViews = async (req, res) => {
  try {
    const article = await NewsArticle.findOne({
      where: { slug: req.params.slug, status: "Published" },
    });

    if (!article)
      return res
        .status(404)
        .json({ message: "Article not found or not published" });

    await article.increment("views", { by: 1, silent: true });
    await article.reload();

    res.status(200).json({ success: true, views: article.views });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetch all categories (public — for filter dropdowns) and auto-extract trending keywords
exports.getPublicCategories = async (req, res) => {
  try {
    const categories = await NewsCategory.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM NewsArticles AS na
              WHERE na.category_id = NewsCategory.id
                AND na.status = 'Published'
            )`),
            "published_count",
          ],
        ],
      },
      order: [
        ["orderIndex", "ASC"],
        ["name", "ASC"],
      ],
    });

    // Auto-extract keywords from the 20 most recent published titles
    const recentArticles = await NewsArticle.findAll({
      where: { status: "Published" },
      attributes: ["title"],
      limit: 20,
      order: [
        ["published_at", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    const stopWords = [
      "for",
      "in",
      "with",
      "on",
      "from",
      "which",
      "and",
      "at",
      "to",
      "this",
      "that",
      "will",
      "has",
      "by",
      "as",
      "is",
    ];
    const wordCounts = {};
    recentArticles.forEach((a) => {
      const words = (a.title || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/);
      words.forEach((word) => {
        if (word.length > 4 && !stopWords.includes(word)) {
          const cap = word.charAt(0).toUpperCase() + word.slice(1);
          wordCounts[cap] = (wordCounts[cap] || 0) + 1;
        }
      });
    });
    const trendingKeywords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map((entry) => entry[0]);

    if (trendingKeywords.length === 0)
      trendingKeywords.push("News", "Latest", "Update");

    res.status(200).json({ categories, trendingKeywords });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
