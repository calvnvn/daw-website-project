const fs = require("fs");
const path = require("path");
const Settings = require("../models/Settings");
const ApprovalDraft = require("../models/ApprovalDraft");
const { ErpApprovalService } = require("../services/erpApprovalService");
const { deleteSingleFile } = require("../utils/fileRemover");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const sequelize = require("../config/database");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// HELPER: Safely Rename File for Editor Drafts
const applyTempPrefix = (fileObj) => {
  if (!fileObj) return null;
  const newFilename = `TEMP_${fileObj.filename}`;
  const newPath = path.join(fileObj.destination, newFilename);

  try {
    fs.renameSync(fileObj.path, newPath); // Rename fisik di storage
    return newFilename; // Return nama baru untuk database
  } catch (err) {
    console.error(`🚨 Gagal me-rename file ke TEMP_: ${err.message}`);
    return fileObj.filename; // Fallback ke nama asli jika rename gagal
  }
};

exports.getSettings = async (req, res) => {
  try {
    const [settings, created] = await Settings.findOrCreate({
      where: { id: 1 },
      defaults: {
        companyName: "PT Dharma Agung Wijaya",
        is_locked: false,
      },
      attributes: [
        "id",
        "companyName",
        "address",
        "phone",
        "email",
        "website",
        "googleMapsUrl",
        "linkedinUrl",
        "logoUrl",
        "faviconUrl",
        "is_locked",
        "lock_ticket",
      ],
    });

    if (created)
      console.log(">>> [SETTINGS] Initialized default record (ID 1)");

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("🚨 Error GET Settings:", error);
    res
      .status(500)
      .json({ success: false, message: "Gagal mengambil pengaturan sistem." });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const id = 1; // Singleton Constraint
    const settings = await Settings.findByPk(id);

    if (!settings) {
      return res
        .status(404)
        .json({ success: false, message: "Record settings tidak ditemukan." });
    }

    const userRole = req.userRole ? req.userRole.toLowerCase().trim() : "";
    const { status, previous_notrans, ...textContent } = req.body;

    // THE GATEKEEPER
    if (userRole === "editor" && settings.is_locked) {
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Pengaturan sedang dikunci oleh antrean approval.",
        ticket: settings.lock_ticket,
      });
    }

    let updatePayload = { ...textContent };

    // Identifikasi File (Jika ada)
    const uploadedLogo = req.files?.["logo"] ? req.files["logo"][0] : null;
    const uploadedFavicon = req.files?.["favicon"]
      ? req.files["favicon"][0]
      : null;

    // JALUR SUPERADMIN: SOVEREIGN BYPASS (LIVE COMMIT)
    if (userRole === "superadmin" || userRole === "admin") {
      console.log(">>> [SETTINGS] JALUR SUPERADMIN: BYPASSING APPROVAL <<<");

      // Admin tidak butuh TEMP_ prefix
      if (uploadedLogo) updatePayload.logoUrl = uploadedLogo.filename;
      if (uploadedFavicon) updatePayload.faviconUrl = uploadedFavicon.filename;

      const t = await sequelize.transaction();
      try {
        // 1. The Atomic Draft Killer: Bunuh draf Editor yang menggantung
        await invalidateOldDrafts("Settings", id, t);

        // 2. Commit Update ke DB Lokal
        await settings.update(
          {
            ...updatePayload,
            is_locked: false,
            lock_ticket: null,
          },
          { transaction: t },
        );

        await t.commit();

        // 3. Final Physical Asset Management (Hapus file LAMA hanya jika transaksi DB SUKSES)
        if (uploadedLogo && settings.logoUrl)
          deleteSingleFile(settings.logoUrl);
        if (uploadedFavicon && settings.faviconUrl)
          deleteSingleFile(settings.faviconUrl);

        return res.status(200).json({
          success: true,
          message: "Settings diperbarui secara live!",
          data: settings,
        });
      } catch (dbError) {
        await t.rollback();
        throw dbError;
      }
    }

    // JALUR EDITOR: INITIATING HANDSHAKE (DRAFT MODE)
    if (userRole === "editor") {
      console.log(">>> [SETTINGS] JALUR EDITOR: INITIATING HANDSHAKE <<<");

      // 1. File Handling: Tambahkan TEMP_ prefix agar aman di storage
      if (uploadedLogo) updatePayload.logoUrl = applyTempPrefix(uploadedLogo);
      if (uploadedFavicon)
        updatePayload.faviconUrl = applyTempPrefix(uploadedFavicon);

      // 2. Draft Resolution: Tandai draf lama sebagai 'Replaced' jika ini resubmission
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      // 3. Network Call to ERP
      try {
        const result = await ErpApprovalService.initiateApproval({
          model: Settings,
          targetId: id,
          action: "UPDATE",
          payload: updatePayload,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        // 4. Optimistic Lock Local Data
        await settings.update({
          is_locked: true,
          lock_ticket: result.notrans,
        });

        return res.status(202).json({
          success: true,
          message: "Revisi profil diajukan. Data sekarang dikunci.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        if (updatePayload.logoUrl) deleteSingleFile(updatePayload.logoUrl);
        if (updatePayload.faviconUrl)
          deleteSingleFile(updatePayload.faviconUrl);

        console.error(
          "🚨 [SETTINGS] ERP Approval Gagal. Membersihkan file TEMP_ orphaned.",
        );
        throw owlError;
      }
    }

    // Fallback Security
    return res
      .status(403)
      .json({ success: false, message: "Role Anda tidak valid." });
  } catch (error) {
    console.error("🚨 ERROR UPDATE SETTINGS:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memproses pembaruan pengaturan.",
      error: error.message,
    });
  }
};
