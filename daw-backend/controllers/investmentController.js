const investmentService = require("../services/investmentService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("LOCKED")) {
    const ticket = msg.split("tiket ")[1];
    return res.status(423).json({
      success: false,
      message: "Akses Dibatasi. Data ini sedang dikunci oleh proses approval ERP.",
      ticket,
    });
  }

  console.error(`🚨 [INVESTMENT ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

const getRole = (req) => req.userRole ? req.userRole.toLowerCase().trim() : "";
const getActorId = (req) => String(req.owl_username || req.karyawanId || "").trim().toLowerCase();
const getToken = (req) => req.headers["authorization"]?.split(" ")[1] || req.owl_token;

// ==========================================
// PUBLIC
// ==========================================

exports.getPublicInvestmentData = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await investmentService.getPublicInvestmentData(lang);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil data publik investasi.");
  }
};

// ==========================================
// ADMIN DATA
// ==========================================

exports.getAdminInvestmentData = async (req, res) => {
  try {
    const data = await investmentService.getAdminInvestmentData();
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil data admin investasi.");
  }
};

exports.getInvestmentData = async (req, res) => {
  try {
    const data = await investmentService.getInvestmentData();
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil data investasi.");
  }
};

// ==========================================
// CATEGORY CRUD
// ==========================================

exports.getCategories = async (req, res) => {
  try {
    const data = await investmentService.getAllCategories();
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil kategori investasi.");
  }
};

exports.createCategory = async (req, res) => {
  try {
    const result = await investmentService.createCategory({
      userRole: getRole(req),
      body: req.body,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });
    res.status(201).json({ success: true, message: "Kategori berhasil dibuat.", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat kategori.");
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const result = await investmentService.updateCategory({
      id: req.params.id,
      userRole: getRole(req),
      body: req.body,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });
    res.status(200).json({ success: true, message: "Kategori berhasil diperbarui.", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui kategori.");
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await investmentService.deleteCategory({
      id: req.params.id,
      userRole: getRole(req),
    });
    res.status(200).json({ success: true, message: "Kategori berhasil dihapus." });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus kategori.");
  }
};

// ==========================================
// SETTINGS
// ==========================================

exports.updateSettings = async (req, res) => {
  try {
    const result = await investmentService.updateSettings({
      req, res,
      userRole: getRole(req),
      body: req.body,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (res.headersSent) return;

    res.status(200).json({ success: true, message: "Pengaturan berhasil diperbarui secara langsung.", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui pengaturan investasi.");
  }
};

// ==========================================
// AFFILIATE CRUD
// ==========================================

exports.createAffiliate = async (req, res) => {
  try {
    const result = await investmentService.createAffiliate({
      req, res,
      userRole: getRole(req),
      body: req.body,
      file: req.file,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (res.headersSent) return;

    res.status(201).json({ success: true, message: "Affiliate berhasil dibuat secara permanen.", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat afiliasi.");
  }
};

exports.updateAffiliate = async (req, res) => {
  try {
    const result = await investmentService.updateAffiliate({
      req, res,
      id: req.params.id,
      userRole: getRole(req),
      body: req.body,
      file: req.file,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (res.headersSent) return;

    if (result && result.noChanges) {
      return res.status(200).json({ success: true, message: "Tidak ada perubahan data. Permintaan diabaikan." });
    }

    res.status(200).json({ success: true, message: "Affiliate berhasil diperbarui secara permanen!", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui afiliasi.");
  }
};

exports.deleteAffiliate = async (req, res) => {
  try {
    const result = await investmentService.deleteAffiliate({
      req, res,
      id: req.params.id,
      userRole: getRole(req),
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (res.headersSent) return;

    res.status(200).json({ success: true, message: "Affiliate beserta gambarnya berhasil dihapus secara permanen!" });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus afiliasi.");
  }
};
