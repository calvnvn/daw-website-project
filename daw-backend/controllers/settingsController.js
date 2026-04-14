const sequelize = require("../config/database");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");

// --- 1. GET Data Settings ---
exports.getSettings = async (req, res) => {
  try {
    const [settings] = await sequelize.query(
      "SELECT * FROM Settings WHERE id = 1 LIMIT 1",
      { type: sequelize.QueryTypes.SELECT },
    );

    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error GET Settings:", error);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};

// --- 2. PUT Data Settings ---
exports.updateSettings = async (req, res) => {
  try {
    const settings = await Settings.findByPk(1);
    const { status } = req.body;

    // 1. Handle Multiple Files
    let newLogoUrl = settings.logoUrl;
    let newFaviconUrl = settings.faviconUrl;

    if (req.files) {
      if (req.files.logo) newLogoUrl = req.files.logo[0].filename;
      if (req.files.favicon) newFaviconUrl = req.files.favicon[0].filename;
    }

    const packageContent = {
      ...req.body,
      logoUrl: newLogoUrl,
      faviconUrl: newFaviconUrl
    };

    // 2. JALUR EDITOR
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: Settings,
        targetId: 1,
        action: "UPDATE",
        payload: packageContent,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Global Settings revision sent to OWL." });
    }

    // 3. JALUR SUPERADMIN
    await settings.update({ ...packageContent, is_locked: false, lock_ticket: null });
    res.status(200).json({ message: "Settings updated directly!" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};