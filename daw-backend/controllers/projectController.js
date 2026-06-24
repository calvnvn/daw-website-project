const projectService = require("../services/projectService");

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

  console.error(`🚨 [PROJECT ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

// ─── ADMIN ENDPOINTS ───

exports.getAllProjects = async (req, res) => {
  try {
    const data = await projectService.getAllProjects();
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil semua proyek");
  }
};

exports.getProjectById = async (req, res) => {
  try {
    const data = await projectService.getProjectById(req.params.id);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil detail proyek");
  }
};

exports.createProject = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await projectService.createProject({
      req, res,
      body: req.body,
      files: req.files,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (result && result.success) {
      return res.status(201).json(result);
    }
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat proyek baru.");
  }
};

exports.updateProject = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await projectService.updateProject({
      req, res,
      id: req.params.id,
      body: req.body,
      files: req.files,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (result && result.success) {
      return res.status(200).json(result);
    }
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui proyek.");
  }
};

exports.deleteProject = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);

    const result = await projectService.deleteProject({
      req, res,
      id: req.params.id,
      userRole: req.userRole,
      actorId,
    });

    if (result && result.success) {
      return res.status(200).json(result);
    }
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus proyek.");
  }
};

exports.uploadInlineImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided." });
    const baseUrl = (process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    res.status(200).json({ message: "Image uploaded succesfully", url: fileUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── PUBLIC READ-ONLY ENDPOINTS ───

exports.getPublicProjects = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const result = await projectService.getPublicProjects(lang);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch public projects.");
  }
};

exports.getPublicProjectById = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const result = await projectService.getPublicProjectById(req.params.id, lang);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error, "Project not found or not published");
  }
};

exports.getPublicProjectBySlug = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const result = await projectService.getPublicProjectBySlug(req.params.slug, lang);
    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error, "Project not found or not published");
  }
};

exports.incrementProjectView = async (req, res) => {
  try {
    await projectService.incrementProjectView(req.params.id);
    res.status(200).json({ message: "View incremented" });
  } catch (error) {
    handleServiceError(res, error, "Failed to increment view");
  }
};
