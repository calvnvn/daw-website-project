const sequelize = require("../config/database");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");
const Settings = require("../models/Settings");

// --- 1. GET Data Settings ---
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.findByPk(1);

    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }
    res.status(200).json(settings);
  } catch (error) {
    console.error("🚨 Error GET Settings:", error);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};

// --- 2. PUT Data Settings ---
exports.updateSettings = async (req, res) => {
  try {
    const id = 1; // Singleton ID
    const settings = await Settings.findByPk(id);

    if (!settings) {
      return res.status(404).json({ message: "Pengaturan tidak ditemukan." });
    }

    const userRole = req.userRole?.toLowerCase();

    // 🔒 1. CEK GEMBOK (Hanya untuk Editor)
    if (userRole === "editor" && settings.is_locked) {
      return res.status(423).json({
        message: "Settings sedang dikunci oleh proses approval di OWL.",
        ticket: settings.lock_ticket,
      });
    }

    // 📦 2. PREPARE DATA (Olah Teks & File)
    let updatePayload = { ...req.body };

    // Handle File (Logo & Favicon)
    if (req.files) {
      if (req.files["logo"]) {
        updatePayload.logoUrl = req.files["logo"][0].filename;
      }
      if (req.files["favicon"]) {
        updatePayload.faviconUrl = req.files["favicon"][0].filename;
      }
    }

    // 🚀 3. JALUR SUPERADMIN (Direct Commit)
    if (userRole === "superadmin") {
      console.log(">>> [SETTINGS] JALUR SUPERADMIN: BYPASSING OWL <<<");

      // Hapus file lama jika ada file baru yang diupload
      if (req.files?.["logo"] && settings.logoUrl)
        deleteSingleFile(settings.logoUrl);
      if (req.files?.["favicon"] && settings.faviconUrl)
        deleteSingleFile(settings.faviconUrl);

      await settings.update({
        ...updatePayload,
        is_locked: false,
        lock_ticket: null,
      });

      return res.status(200).json({
        message: "Settings updated successfully (Direct Commit)!",
      });
    }

    // 🕒 4. JALUR EDITOR (Approval Workflow)
    // Pastikan frontend ngirim status: "Published" kalau mau diajuin ke OWL
    if (userRole === "editor") {
      console.log(">>> [SETTINGS] JALUR EDITOR: INITIATING WORKFLOW <<<");

      const result = await ErpApprovalService.initiateApproval({
        model: Settings,
        targetId: id,
        action: "UPDATE",
        payload: updatePayload,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      return res.status(202).json({
        message: "Revisi Global Settings telah diajukan ke OWL.",
        ticket: result.notrans,
      });
    }

    // Fallback if role not recognized
    return res
      .status(403)
      .json({ message: "Role tidak diizinkan mengubah settings." });
  } catch (error) {
    console.error("🚨 ERROR UPDATE SETTINGS:", error);
    res.status(500).json({ message: error.message });
  }
};
