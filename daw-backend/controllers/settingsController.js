const settingsService = require("../services/settingsService");

/**
 * Handle custom service errors and map them to appropriate HTTP responses
 */
const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("LOCKED")) {
    const ticket = msg.split("tiket ")[1];
    return res.status(423).json({
      success: false,
      message: "Akses Dibatasi. Pengaturan sedang dikunci oleh antrean approval.",
      ticket,
    });
  }

  if (msg.startsWith("FORBIDDEN")) {
    return res.status(403).json({ success: false, message: msg.split(": ")[1] });
  }

  console.error(`🚨 [SETTINGS ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

/**
 * GET: System Settings
 * Retrieves the singleton settings record (ID: 1) and checks for rejected drafts.
 */
exports.getSettings = async (req, res) => {
  try {
    const result = await settingsService.getSettings();
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil pengaturan sistem.");
  }
};

/**
 * PUT: Update Settings
 * Orchestrates logic based on user role.
 */
exports.updateSettings = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await settingsService.updateSettings({
      body: req.body,
      files: req.files,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Revisi profil diajukan. Data sekarang dikunci.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({
      success: true,
      message: "Settings diperbarui secara live!",
      data: result.data,
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal memproses pembaruan pengaturan.");
  }
};
