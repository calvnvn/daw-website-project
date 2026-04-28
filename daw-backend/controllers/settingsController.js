const fs = require("fs");
const path = require("path");
const Settings = require("../models/Settings");
const ApprovalDraft = require("../models/ApprovalDraft");
const ErpApprovalService = require("../services/erpApprovalService");

const { deleteSingleFile } = require("../utils/fileRemover");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const sequelize = require("../config/database");
const { generateNotrans } = require("../utils/notransGenerator");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// HELPER: Safely Rename File for Editor Drafts
const applyTempPrefix = (fileObj) => {
  if (!fileObj || !fileObj.path) return null;

  const oldPath = fileObj.path;
  const directory = path.dirname(oldPath);
  const newFilename = `TEMP_${fileObj.filename}`;
  const newPath = path.join(directory, newFilename);

  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(
        `[FILE SYSTEM] Success: ${fileObj.filename} -> ${newFilename}`,
      );
      return newFilename;
    } else {
      console.warn(`🚨 File asli tidak ditemukan di: ${oldPath}`);
      return fileObj.filename;
    }
  } catch (err) {
    console.error(`🚨 Gagal me-rename file ke TEMP_: ${err.message}`);
    return fileObj.filename;
  }
};

exports.getSettings = async (req, res) => {
  try {
    // 🚀 PERBAIKAN: Ubah nama variabel destructuring menjadi 'settingsInstance'
    const [settingsInstance, created] = await Settings.findOrCreate({
      where: { id: 1 },
      defaults: {
        companyName: "PT Dharma Agung Wijaya",
        is_locked: false,
      },
    });

    if (created)
      console.log(">>> [SETTINGS] Initialized default record (ID 1)");

    // 🚀 AMAN: Ekstrak plain object dari 'settingsInstance' ke konstanta 'settings'
    const settings = settingsInstance.get({ plain: true });

    const rejectedDraft = await ApprovalDraft.findOne({
      where: {
        module_name: "Settings",
        target_id: "1",
        status: "Rejected",
      },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: settings, // Kirim object bersih
      has_rejected: !!rejectedDraft,
      rejected_data: rejectedDraft || null,
    });
  } catch (error) {
    console.error("🚨 Error GET Settings:", error);
    res
      .status(500)
      .json({ success: false, message: "Gagal mengambil pengaturan sistem." });
  }
};

exports.updateSettings = async (req, res) => {
  const t = await sequelize.transaction();

  // Deteksi file untuk kebutuhan cleanup jika error
  const uploadedLogo = req.files?.["logo"] ? req.files["logo"][0] : null;
  const uploadedFavicon = req.files?.["favicon"]
    ? req.files["favicon"][0]
    : null;
  let tempLogoPath = null;
  let tempFaviconPath = null;

  try {
    const id = 1;
    const userRole = req.userRole ? req.userRole.toLowerCase().trim() : "";
    const actorId = String(req.owl_username || req.karyawanId);
    const { status, previous_notrans, ...textContent } = req.body;

    // FETCH & ROW-LEVEL LOCK
    const settings = await Settings.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!settings) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Settings not found." });
    }

    // CONCURRENCY GUARD
    if (userRole === "editor" && settings.is_locked) {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Pengaturan sedang dikunci oleh antrean approval.",
        ticket: settings.lock_ticket,
      });
    }

    let updatePayload = {
      ...settings.toJSON(),
      ...textContent,
    };
    delete updatePayload.id;
    delete updatePayload.createdAt;
    delete updatePayload.updatedAt;

    // JALUR SUPERADMIN: SOVEREIGN BYPASS (LIVE COMMIT - 200)
    if (userRole === "superadmin" || userRole === "admin") {
      console.log(">>> [SETTINGS] JALUR SUPERADMIN: BYPASSING APPROVAL <<<");

      const oldLogoUrl = settings.logoUrl;
      const oldFaviconUrl = settings.faviconUrl;

      if (uploadedLogo) updatePayload.logoUrl = uploadedLogo.filename;
      if (uploadedFavicon) updatePayload.faviconUrl = uploadedFavicon.filename;

      await invalidateOldDrafts("Settings", id, t);

      // Commit Update ke DB Lokal
      await settings.update(
        {
          ...updatePayload,
          is_locked: false,
          lock_ticket: null,
        },
        { transaction: t },
      );

      await t.commit();
      await settings.reload();

      if (uploadedLogo && oldLogoUrl) deleteSingleFile(oldLogoUrl);
      if (uploadedFavicon && oldFaviconUrl) deleteSingleFile(oldFaviconUrl);

      return res.status(200).json({
        success: true,
        message: "Settings diperbarui secara live!",
        data: settings.get({ plain: true }),
      });
    }

    // EDITOR
    if (userRole === "editor") {
      console.log(">>> [SETTINGS] JALUR EDITOR: THE BATON PASS PROTOCOL <<<");

      // File Handling (Temp Prefix)
      if (uploadedLogo) {
        tempLogoPath = applyTempPrefix(uploadedLogo);
        updatePayload.logoUrl = tempLogoPath;
      }
      if (uploadedFavicon) {
        tempFaviconPath = applyTempPrefix(uploadedFavicon);
        updatePayload.faviconUrl = tempFaviconPath;
      }

      // Draft Resolution
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }
      await invalidateOldDrafts("Settings", id, t);

      const notrans = await generateNotrans("SET");

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Settings",
          target_id: String(id),
          action: "UPDATE",
          payload: updatePayload,
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await settings.update(
        {
          is_locked: true,
          lock_ticket: notrans,
        },
        { transaction: t },
      );

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: "Settings",
          karyawanId: req.karyawanId,
          token: req.owl_token,
        });
      } catch (owlError) {
        console.error(
          "🚨 [SETTINGS] ERP Initiate Failed (Local Draft Secured):",
          owlError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Revisi profil diajukan. Data sekarang dikunci.",
        ticket: notrans,
      });
    }

    if (t && !t.finished) await t.rollback();
    return res
      .status(403)
      .json({ success: false, message: "Role Anda tidak valid." });
  } catch (error) {
    if (t && !t.finished) {
      console.log(">>> [DATABASE] Rolling back transaction due to error...");
      await t.rollback();
    }

    // Hapus file fisik TEMP yang terlanjur terbuat jika DB gagal commit
    if (tempLogoPath) deleteSingleFile(tempLogoPath);
    if (tempFaviconPath) deleteSingleFile(tempFaviconPath);
    // Hapus file asli yang diupload Admin jika gagal
    if (uploadedLogo && !tempLogoPath) deleteSingleFile(uploadedLogo.filename);
    if (uploadedFavicon && !tempFaviconPath)
      deleteSingleFile(uploadedFavicon.filename);

    console.error("🚨 ERROR UPDATE SETTINGS:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memproses pembaruan pengaturan.",
      error: error.message,
    });
  }
};
