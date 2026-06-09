const aboutService = require("../services/aboutService");

// Retrieve singleton entity and dynamically inject rejection status via correlated subquery
exports.getAboutInfo = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await aboutService.getAboutInfo(lang);
    res.status(200).json(data);
  } catch (error) {
    if (error.message.startsWith("NOT_FOUND")) {
      return res.status(404).json({ message: error.message.split(": ")[1] });
    }
    console.error("🚨 [GET ABOUT ERROR]:", error.message);
    res.status(500).json({ message: "Failed to fetch about info" });
  }
};

// Orchestrate conditional mutation logic enforcing Role-Based Access Control and transaction staging
exports.updateAboutInfo = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await aboutService.updateAboutInfo({
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
      return res.status(423).json({ message: "Data sedang dikunci.", ticket });
    }
    console.error("🚨 [UPDATE ABOUT ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};
