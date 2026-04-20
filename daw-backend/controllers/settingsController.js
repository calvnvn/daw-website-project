const Settings = require("../models/Settings");
const ApprovalDraft = require("../models/ApprovalDraft");
const ErpApprovalService = require("../services/erpApprovalService");
const { deleteSingleFile } = require("../utils/fileRemover");
const sequelize = require("../config/database");

exports.getSettings = async (req, res) => {
  try {
    const [settings, created] = await Settings.findOrCreate({
      where: { id: 1 },
      defaults: {
        companyName: "PT Dharma Agung Wijaya",
        is_locked: false,
      },
    });

    if (created)
      console.log(">>> [SETTINGS] Initialized default record (ID 1)");

    res.status(200).json(settings);
  } catch (error) {
    console.error("🚨 Error GET Settings:", error);
    res.status(500).json({ message: "Gagal mengambil pengaturan sistem." });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const id = 1;
    const settings = await Settings.findByPk(id);

    if (!settings)
      return res
        .status(404)
        .json({ message: "Record settings tidak ditemukan." });

    const userRole = req.userRole ? req.userRole.toLowerCase().trim() : "";
    const { status, previous_notrans, ...textContent } = req.body;

    if (userRole === "editor" && settings.is_locked) {
      return res.status(423).json({
        message: "Pengaturan sedang dikunci oleh antrean approval OWL.",
        ticket: settings.lock_ticket,
      });
    }

    let updatePayload = { ...textContent };

    // Mapping File Baru (Jika ada upload)
    if (req.files?.["logo"])
      updatePayload.logoUrl = req.files["logo"][0].filename;
    if (req.files?.["favicon"])
      updatePayload.faviconUrl = req.files["favicon"][0].filename;
    if (userRole === "superadmin" || userRole === "admin") {
      console.log(">>> [SETTINGS] JALUR SUPERADMIN: BYPASSING APPROVAL <<<");

      if (req.files?.["logo"] && settings.logoUrl)
        deleteSingleFile(settings.logoUrl);
      if (req.files?.["favicon"] && settings.faviconUrl)
        deleteSingleFile(settings.faviconUrl);

      await settings.update({
        ...updatePayload,
        is_locked: false,
        lock_ticket: null,
      });

      return res
        .status(200)
        .json({ message: "Settings diperbarui secara langsung!" });
    }

    if (userRole === "editor") {
      console.log(">>> [SETTINGS] JALUR EDITOR: INITIATING HANDSHAKE <<<");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: Settings,
        targetId: id,
        action: "UPDATE",
        payload: updatePayload,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      await settings.update({
        is_locked: true,
        lock_ticket: result.notrans,
      });

      return res.status(202).json({
        message: "Revisi profil dikirim ke OWL. Data sekarang dikunci.",
        ticket: result.notrans,
      });
    }

    return res
      .status(403)
      .json({ message: "Role Anda tidak memiliki akses ke pengaturan ini." });
  } catch (error) {
    console.error("🚨 ERROR UPDATE SETTINGS:", error.message);
    res.status(500).json({
      message: "Gagal memproses pembaruan pengaturan.",
      error: error.message,
    });
  }
};
