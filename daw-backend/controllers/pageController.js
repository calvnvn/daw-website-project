const pageService = require("../services/pageService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("LOCKED")) {
    const ticket = msg.split("tiket ")[1];
    return res.status(423).json({
      success: false,
      message: "Halaman terkunci.",
      ticket,
    });
  }

  console.error(`🚨 [PAGE ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg, error: msg });
};

const getRole = (req) => req.userRole ? req.userRole.toLowerCase().trim() : "";
const getActorId = (req) => String(req.owl_username || req.karyawanId || "").trim().toLowerCase();

exports.getAllPages = async (req, res) => {
  try {
    const data = await pageService.getAllPages();
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch pages");
  }
};

exports.getPageBySlug = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await pageService.getPageBySlug(req.params.slug, lang);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Error fetching page");
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
  try {
    await pageService.createPage({
      req, res,
      userRole: getRole(req),
      body: req.body,
      file: req.file,
      actorId: getActorId(req),
    });
  } catch (error) {
    handleServiceError(res, error, "Failed to create page");
  }
};

exports.updatePage = async (req, res) => {
  try {
    await pageService.updatePage({
      req, res,
      id: req.params.id,
      userRole: getRole(req),
      body: req.body,
      file: req.file,
      actorId: getActorId(req),
    });
  } catch (error) {
    handleServiceError(res, error, "Failed to update page");
  }
};

exports.deletePage = async (req, res) => {
  try {
    await pageService.deletePage({
      req, res,
      id: req.params.id,
      userRole: getRole(req),
      actorId: getActorId(req),
    });
  } catch (error) {
    handleServiceError(res, error, "Failed to delete page");
  }
};
