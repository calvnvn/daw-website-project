const philosophyService = require("../services/philosophyService");

// Retrieve singleton record with a rejection radar subquery
exports.getPhilosophy = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await philosophyService.getPhilosophy(lang);
    res.status(200).json(data);
  } catch (error) {
    if (error.message.startsWith("NOT_FOUND")) {
      return res.status(404).json({ message: "Philosophy data not found" });
    }
    console.error("🚨 [GET PHILOSOPHY ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Orchestrate update logic (Editor staging vs Admin direct commit)
exports.updatePhilosophy = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "").trim().toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await philosophyService.updatePhilosophy({
      req, res,
      body: req.body,
      userRole: req.userRole,
      actorId,
      karyawanId: req.karyawanId,
      owlToken,
    });

    if (res.headersSent) return;

    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    if (error.message.startsWith("LOCKED")) {
      const ticket = error.message.split("tiket ")[1];
      return res.status(423).json({
        message: "Philosophy sedang dikunci.",
        ticket,
      });
    }
    console.error("🚨 [UPDATE PHILOSOPHY ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};
