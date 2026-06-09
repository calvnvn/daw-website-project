const philosophyPillarService = require("../services/philosophyPillarService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("LOCKED")) {
    const ticket = msg.split("tiket ")[1];
    return res.status(423).json({
      message: "Pilar ini sedang dikunci oleh proses approval.",
      ticket,
    });
  }

  console.error(`🚨 [PILLAR ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

// Fetch all pillars including dynamic rejection flags via subquery
exports.getPillars = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await philosophyPillarService.getPillars(lang);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat Pilar Filosofi");
  }
};

// Orchestrate new pillar creation (Editor staging vs Admin direct commit)
exports.createPillar = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "").trim().toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await philosophyPillarService.createPillar({
      req, res,
      body: req.body,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (res.headersSent) return;

    res.status(201).json({ success: true, message: "Pilar baru berhasil ditambahkan." });
  } catch (error) {
    handleServiceError(res, error, "Gagal menambahkan pilar.");
  }
};

// Mutate existing pillar with pessimistic locking and role-based routing
exports.updatePillar = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "").trim().toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await philosophyPillarService.updatePillar({
      req, res,
      id: req.params.id,
      body: req.body,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (res.headersSent) return;

    res.status(200).json({ success: true, message: "Pilar berhasil diperbarui." });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui pilar.");
  }
};

// Safely remove pillar via ERP staging or direct database purge
exports.deletePillar = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "").trim().toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await philosophyPillarService.deletePillar({
      req, res,
      id: req.params.id,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (res.headersSent) return;

    res.status(200).json({ success: true, message: "Pilar berhasil dihapus." });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus pilar.");
  }
};
