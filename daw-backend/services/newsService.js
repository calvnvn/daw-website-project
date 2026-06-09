const NewsArticle = require("../models/NewsArticle");
const NewsCategory = require("../models/NewsCategory");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { deleteSingleFile } = require("../utils/fileRemover");
const { autoTranslate } = require("./openaiService");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const ErpApprovalService = require("./erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");
const { extractImagesFromHtml, generateUniqueSlug, handleEditorStaging } = require("../utils/editorHelper");
const { saveManualTranslations } = require("../utils/translationHelper");

const MODULE_NAME = "NewsArticle";

class NewsService {
  /**
   * Helper: Calculates estimated reading time from HTML content using dynamic WPM.
   */
  calculateReadTime(htmlContent) {
    if (!htmlContent) return "1 min read";
    const plainText = htmlContent
      .replace(/<[^>]*>?/gm, "")
      .replace(/&nbsp;|\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    const wpm = parseInt(process.env.READING_TIME_WPM) || 200;
    const minutes = Math.ceil(wordCount / wpm);
    return `${Math.max(1, minutes)} min read`;
  }

  /**
   * Background Translation Worker
   */
  async triggerBackgroundTranslation(articleId, payload) {
    try {
      const { title, excerpt, content } = payload;
      
      const safeTranslateBG = async (field, sourceValue) => {
        let transRecord = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(articleId), field, locale: "id" } });
        if (!sourceValue || !String(sourceValue).trim()) {
           if (transRecord) await transRecord.destroy();
           return;
        }
        const fresh = await autoTranslate(sourceValue, "Indonesian");
        if (fresh) {
           if (transRecord) await transRecord.update({ translatedText: fresh });
           else await Translation.create({ modelName: MODULE_NAME, recordId: String(articleId), field, locale: "id", translatedText: fresh });
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
   * Consolidates payload parsing, image diffing, and slug generation.
   */
  async processNewsPayload(body, file, user, article) {
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
    } = body;

    const authorIdentity = author || article.author || user.actorId || "System Admin";

    let filesToDelete = [];
    let coverImageName = article?.cover_image || null;
    let oldCoverToDelete = null;

    const cleanContent = content ?? article.content ?? "";

    if (article.content) {
      const oldHtmlImages = extractImagesFromHtml(article.content);
      const newHtmlImages = extractImagesFromHtml(cleanContent);
      const deletedHtmlImages = oldHtmlImages.filter((img) => !newHtmlImages.includes(img));
      filesToDelete = [...filesToDelete, ...deletedHtmlImages];
    }

    if (file) {
      oldCoverToDelete = article.cover_image;
      coverImageName = file.filename;
    }

    let finalSlug = article.slug;
    if (slug && slug !== article.slug) {
      finalSlug = await generateUniqueSlug(NewsArticle, MODULE_NAME, slug, article.id);
    } else if (title && title !== article.title) {
      finalSlug = await generateUniqueSlug(NewsArticle, MODULE_NAME, title, article.id);
    }

    const allFilesToTrash = [...filesToDelete];
    if (oldCoverToDelete) allFilesToTrash.push(oldCoverToDelete);

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
        read_time: read_time && read_time.trim() ? read_time.trim() : this.calculateReadTime(cleanContent),
        gallery_images: parsedGallery,
        _filesToDelete: allFilesToTrash,
      },
      filesToDelete,
      oldCoverToDelete,
    };
  }

  // ─── ADMIN ENDPOINTS ───

  async getAllNews() {
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

    return articles.map((a) => {
      const data = a.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });
  }

  async getNewsById(id) {
    const article = await NewsArticle.findByPk(id, {
      include: [
        {
          model: NewsCategory,
          as: "categoryData",
          attributes: ["id", "name", "slug", "color"],
        },
      ],
    });

    if (!article) throw new Error("NOT_FOUND: Article not found");
    return article;
  }

  async createNews({ req, res, body, file, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const { previous_notrans, status: requestStatus } = body;
      const normalizedRole = userRole?.toLowerCase();

      const { payload } = await this.processNewsPayload(
        body,
        file,
        { actorId },
        { title: "", slug: "", cover_image: null }
      );

      // Branch A: Editor requests publication
      if (normalizedRole === "editor" && requestStatus === "Published") {
        const newArticle = await NewsArticle.create(
          { ...payload, status: "Draft", is_locked: true },
          { transaction: t }
        );

        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: "News",
          action: "CREATE",
          targetId: newArticle.id,
          payload: { ...payload, status: "Published", _translations: body._translations },
          recordToLock: newArticle,
          previousNotrans: previous_notrans,
          successMessage: "Artikel baru diajukan. Data dikunci menunggu persetujuan.",
          onSuccessCallback: (id, payload) => this.triggerBackgroundTranslation(id, payload),
        });
      }

      // Branch B: Admin publishes directly, or Editor saves as Draft.
      const finalStatus = requestStatus === "Published" ? "Published" : "Draft";
      const newArticle = await NewsArticle.create(
        { ...payload, status: finalStatus, is_locked: false },
        { transaction: t }
      );

      if (body._translations) {
        await saveManualTranslations(MODULE_NAME, newArticle.id, body._translations, t);
      }
      await t.commit();
      
      this.triggerBackgroundTranslation(newArticle.id, { ...payload, _translations: body._translations });

      return res.status(201).json({
        success: true,
        message: finalStatus === "Draft" ? "Draf artikel berhasil disimpan." : "Artikel berhasil dipublikasikan.",
        data: newArticle,
      });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateNews({ req, res, id, body, file, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase();
      const { status, previous_notrans } = body;

      const article = await NewsArticle.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!article) {
        await t.rollback();
        throw new Error("NOT_FOUND: Article not found");
      }

      if (article.is_locked) {
        if (normalizedRole === "editor") {
          await t.rollback();
          throw new Error(`LOCKED: tiket ${article.lock_ticket}`);
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

      const { payload, filesToDelete, oldCoverToDelete } = await this.processNewsPayload(
        body,
        file,
        { actorId },
        article
      );

      // Branch A: Editor requests publication
      if (normalizedRole === "editor" && status === "Published") {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: "News",
          action: "UPDATE",
          targetId: id,
          payload: { ...payload, status: "Published", _translations: body._translations },
          recordToLock: article,
          previousNotrans: previous_notrans,
          successMessage: "Revisi diajukan. Data asli dikunci.",
          onSuccessCallback: (id, payload) => this.triggerBackgroundTranslation(id, payload),
        });
      }

      // Branch B: Admin executes live update
      if (normalizedRole === "superadmin" || normalizedRole === "admin") {
        await invalidateOldDrafts(MODULE_NAME, id, t);
      }

      await article.update(
        { ...payload, is_locked: false, lock_ticket: null },
        { transaction: t }
      );

      if (body._translations) {
        await saveManualTranslations(MODULE_NAME, id, body._translations, t);
      }
      await t.commit();

      this.triggerBackgroundTranslation(id, { ...payload, _translations: body._translations });

      if (normalizedRole === "superadmin" || (normalizedRole === "editor" && status === "Draft")) {
        filesToDelete.forEach((f) => deleteSingleFile(f));
        if (oldCoverToDelete) deleteSingleFile(oldCoverToDelete);
      }

      return res.status(200).json({
        success: true,
        message: status === "Draft" ? "Draf disimpan." : "Override sukses.",
      });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteNews({ req, res, id, userRole, actorId }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase();

      const article = await NewsArticle.findByPk(id, { transaction: t });
      if (!article) {
        await t.rollback();
        throw new Error("NOT_FOUND: Article not found");
      }

      if (article.is_locked && normalizedRole === "editor") {
        await t.rollback();
        throw new Error(`LOCKED: tiket ${article.lock_ticket}`);
      }

      if (normalizedRole === "editor") {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: "News",
          action: "DELETE",
          targetId: id,
          payload: { title: article.title, reason: "Request Delete" },
          recordToLock: article,
          successMessage: "Permintaan hapus dikirim.",
        });
      }

      await invalidateOldDrafts(MODULE_NAME, id, t);
      await article.destroy({ transaction: t });
      await Translation.destroy({ where: { modelName: MODULE_NAME, recordId: String(id) }, transaction: t });
      await t.commit();

      if (article.cover_image) deleteSingleFile(article.cover_image);

      const contentImages = extractImagesFromHtml(article.content);
      contentImages.forEach((f) => deleteSingleFile(f));

      return res.status(200).json({ success: true, message: "Artikel dihapus permanen." });
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  // ─── PUBLIC ENDPOINTS ───

  async getPublicNews(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 6;
    const offset = (page - 1) * limit;
    const search = query.search || "";
    const category = query.category || "";
    const sortBy = query.sortBy || "latest";
    const lang = query.lang || "en";

    const whereClause = { status: "Published" };
    if (search) whereClause.title = { [Op.like]: `%${search}%` };
    if (category) whereClause.category_id = category;

    let orderClause;
    if (sortBy === "oldest") {
      orderClause = [
        [sequelize.literal("COALESCE(`NewsArticle`.`published_at`, `NewsArticle`.`createdAt`)"), "ASC"],
        ["id", "ASC"],
      ];
    } else if (sortBy === "popular") {
      orderClause = [
        ["views", "DESC"],
        [sequelize.literal("COALESCE(`NewsArticle`.`published_at`, `NewsArticle`.`createdAt`)"), "DESC"],
        ["id", "DESC"],
      ];
    } else {
      orderClause = [
        [sequelize.literal("COALESCE(`NewsArticle`.`published_at`, `NewsArticle`.`createdAt`)"), "DESC"],
        ["id", "DESC"],
      ];
    }

    const { count, rows } = await NewsArticle.findAndCountAll({
      where: whereClause,
      attributes: ["id", "title", "slug", "excerpt", "category_id", "cover_image", "author", "published_at", "read_time", "views", "createdAt"],
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

    let finalRows = rows.map((r) => r.get({ plain: true }));

    if (lang === "id" && finalRows.length > 0) {
      const articleIds = finalRows.map((r) => r.id);
      const translations = await Translation.findAll({
        where: {
          modelName: MODULE_NAME,
          recordId: { [Op.in]: articleIds },
          locale: "id"
        }
      });
      
      finalRows.forEach((row) => {
        const titleTrans = translations.find((t) => t.recordId === String(row.id) && t.field === "title");
        const excerptTrans = translations.find((t) => t.recordId === String(row.id) && t.field === "excerpt");
        
        if (titleTrans) row.title = titleTrans.translatedText;
        if (excerptTrans) row.excerpt = excerptTrans.translatedText;
      });
    }

    return {
      data: finalRows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: limit,
      },
    };
  }

  async getPublicNewsBySlug(slug, lang = "en") {
    const article = await NewsArticle.findOne({
      where: { slug, status: "Published" },
      include: [
        {
          model: NewsCategory,
          as: "categoryData",
          attributes: ["id", "name", "slug", "color"],
        },
      ],
    });

    if (!article) throw new Error("NOT_FOUND: Article not found or not published");

    const result = article.get({ plain: true });

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

  async incrementNewsViews(slug) {
    const article = await NewsArticle.findOne({
      where: { slug, status: "Published" },
    });

    if (!article) throw new Error("NOT_FOUND: Article not found or not published");

    await article.increment("views", { by: 1, silent: true });
    await article.reload();
    return article.views;
  }

  async getPublicCategories() {
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

    const recentArticles = await NewsArticle.findAll({
      where: { status: "Published" },
      attributes: ["title"],
      limit: 20,
      order: [
        ["published_at", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    const stopWords = ["for","in","with","on","from","which","and","at","to","this","that","will","has","by","as","is"];
    const wordCounts = {};
    recentArticles.forEach((a) => {
      const words = (a.title || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
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

    if (trendingKeywords.length === 0) trendingKeywords.push("News", "Latest", "Update");

    return { categories, trendingKeywords };
  }
}

module.exports = new NewsService();
