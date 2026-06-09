const historyService = require("../services/historyService");

// Fetch timeline data with rejection flags
exports.getHistories = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await historyService.getHistories(lang);
    res.status(200).json(data);
  } catch (error) {
    console.error("🚨 [GET HISTORY ERROR]:", error.message);
    res.status(500).json({ message: "Gagal memuat timeline sejarah." });
  }
};

// Orchestrate timeline updates (Editor Staging vs Admin Direct)
exports.updateHistories = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "").trim().toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await historyService.updateHistories({
      req, res,
      body: req.body,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (res.headersSent) return;

    res.status(200).json({ success: true, message: "Timeline diperbarui secara live." });
  } catch (error) {
    if (error.message.startsWith("LOCKED")) {
      const ticket = error.message.split("tiket ")[1];
      return res.status(423).json({
        message: "Timeline sedang dikunci oleh proses approval aktif.",
        ticket,
      });
    }
    console.error("🚨 [UPDATE HISTORY ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};
