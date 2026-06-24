const newsService = require("../services/newsService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("LOCKED")) {
    const ticket = msg.split("tiket ")[1];
    return res.status(423).json({
      message: "Data sedang dikunci oleh proses approval.",
      ticket,
    });
  }

  console.error(`🚨 [NEWS ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

// ─── ADMIN ENDPOINTS ───

exports.getAllNews = async (req, res) => {
  try {
    const data = await newsService.getAllNews();
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil semua artikel berita");
  }
};

exports.getNewsById = async (req, res) => {
  try {
    const data = await newsService.getNewsById(req.params.id);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil artikel berita");
  }
};

exports.createNews = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    // The service handles responses directly for staging via handleEditorStaging,
    // so we pass req and res down. For admin commits, it returns normally.
    const result = await newsService.createNews({
      req, res,
      body: req.body,
      file: req.files ? req.files["cover_image"]?.[0] : null,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (result && result.success) {
      return res.status(201).json(result);
    }
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat artikel berita baru.");
  }
};

exports.updateNews = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await newsService.updateNews({
      req, res,
      id: req.params.id,
      body: req.body,
      file: req.files ? req.files["cover_image"]?.[0] : null,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (result && result.success) {
      return res.status(200).json(result);
    }
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui artikel berita.");
  }
};

exports.deleteNews = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);

    const result = await newsService.deleteNews({
      req, res,
      id: req.params.id,
      userRole: req.userRole,
      actorId,
    });

    if (result && result.success) {
      return res.status(200).json(result);
    }
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus artikel berita.");
  }
};

exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided." });
    const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.status(200).json({ message: "Image uploaded successfully", url: fileUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── PUBLIC READ-ONLY ENDPOINTS ───

exports.getPublicNews = async (req, res) => {
  try {
    const result = await newsService.getPublicNews(req.query);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch news articles.");
  }
};

exports.getPublicNewsBySlug = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const result = await newsService.getPublicNewsBySlug(req.params.slug, lang);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error, "Article not found or not published");
  }
};

exports.incrementNewsViews = async (req, res) => {
  try {
    const views = await newsService.incrementNewsViews(req.params.slug);
    res.status(200).json({ success: true, views });
  } catch (error) {
    handleServiceError(res, error, "Failed to increment views");
  }
};

exports.getPublicCategories = async (req, res) => {
  try {
    const result = await newsService.getPublicCategories();
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch public categories");
  }
};
