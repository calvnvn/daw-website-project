const achievementService = require("../services/achievementService");

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
      message: "Akses ditolak. Data sedang dikunci oleh proses approval OWL.",
      ticket,
    });
  }

  console.error(`🚨 [ACHIEVEMENT ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

// Retrieve all achievements ordered by year and ID in descending order
exports.getAllAchievements = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await achievementService.getAllAchievements(lang);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat data penghargaan.");
  }
};

// Retrieve a specific achievement record by its primary key
exports.getAchievementById = async (req, res) => {
  try {
    const data = await achievementService.getAchievementById(req.params.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat detail penghargaan.");
  }
};

// Orchestrate creation of a new achievement record
exports.createAchievement = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await achievementService.createAchievement({
      body: req.body,
      file: req.file,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan tambah penghargaan dikirim.",
        ticket: result.ticket,
      });
    }

    res.status(201).json({
      success: true,
      message: "Penghargaan berhasil ditambahkan secara live!",
      data: result.data,
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal menambahkan penghargaan.");
  }
};

// Orchestrate updating an achievement record
exports.updateAchievement = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await achievementService.updateAchievement({
      id: req.params.id,
      body: req.body,
      file: req.file,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Draf revisi penghargaan dikirim.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({
      success: true,
      message: "Penghargaan berhasil diperbarui!",
      data: result.data,
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui penghargaan.");
  }
};

// Orchestrate deletion of an achievement record
exports.deleteAchievement = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await achievementService.deleteAchievement({
      id: req.params.id,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan hapus dikirim. Data dikunci.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({
      success: true,
      message: "Penghargaan berhasil dihapus permanen.",
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus penghargaan.");
  }
};
