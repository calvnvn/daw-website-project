const fs = require("fs");
const path = require("path");
const Settings = require("../models/Settings");
const ApprovalDraft = require("../models/ApprovalDraft");
const ErpApprovalService = require("./erpApprovalService");
const { deleteSingleFile } = require("../utils/fileRemover");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const sequelize = require("../config/database");
const { generateNotrans } = require("../utils/notransGenerator");
const { handleEditorStaging } = require("../utils/editorHelper");

const MODULE_NAME = "Settings";
const NOTRANS_PREFIX = "SET";

class SettingsService {
  /**
   * UTILITY: File Staging Protection
   * Renames uploaded files with a TEMP_ prefix for Editor drafts
   * to prevent them from appearing live before approval.
   */
  applyTempPrefix(fileObj) {
    if (!fileObj || !fileObj.filename) return null;

    const filename = fileObj.filename;

    if (filename.startsWith("TEMP_")) {
      // console.log(`🛡️ [FILE SYSTEM] File sudah di-karantina oleh Refinery: ${filename}`);
      return filename;
    }

    const directory = path.join(__dirname, "..", "public", "uploads");
    const oldPath = fileObj.path || path.join(directory, filename);
    const newFilename = `TEMP_${filename}`;
    const newPath = path.join(directory, newFilename);

    try {
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        return newFilename;
      } else {
        return filename;
      }
    } catch (err) {
      console.error(`🚨 [TEMP GUARD] Gagal me-rename file ke TEMP_: ${err.message}`);
      return filename;
    }
  }

  /**
   * Retrieves the singleton settings record (ID: 1) and checks
   * for any active 'Rejected' drafts to alert the UI.
   */
  async getSettings() {
    const [settingsInstance, created] = await Settings.findOrCreate({
      where: { id: 1 },
      defaults: {
        companyName: "PT Dharma Agung Wijaya",
        is_locked: false,
      },
    });

    const settings = settingsInstance.get({ plain: true });

    const rejectedDraft = await ApprovalDraft.findOne({
      where: {
        module_name: MODULE_NAME,
        target_id: "1",
        status: "Rejected",
      },
      order: [["createdAt", "DESC"]],
    });

    return {
      data: settings,
      has_rejected: !!rejectedDraft,
      rejected_data: rejectedDraft || null,
    };
  }

  /**
   * Orchestrates logic based on user role to update settings.
   */
  async updateSettings({ req, res, body, files, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    const uploadedLogo = files?.["logo"] ? files["logo"][0] : null;
    const uploadedFavicon = files?.["favicon"] ? files["favicon"][0] : null;

    let tempLogoPath = null;
    let tempFaviconPath = null;

    try {
      const id = 1;
      const normalizedRole = userRole ? userRole.toLowerCase().trim() : "";
      const { status, previous_notrans, ...textContent } = body;

      const settings = await Settings.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!settings) {
        throw new Error("NOT_FOUND: Settings not found.");
      }

      if (normalizedRole === "editor" && settings.is_locked) {
        throw new Error(`LOCKED: tiket ${settings.lock_ticket}`);
      }

      let updatePayload = {
        ...settings.toJSON(),
        ...textContent,
      };
      delete updatePayload.id;
      delete updatePayload.createdAt;
      delete updatePayload.updatedAt;

      // BRANCH 1: Admin / Superadmin (Direct Live Commit)
      if (normalizedRole === "superadmin" || normalizedRole === "admin") {
        const oldLogoUrl = settings.logoUrl;
        const oldFaviconUrl = settings.faviconUrl;

        if (uploadedLogo) updatePayload.logoUrl = uploadedLogo.filename;
        if (uploadedFavicon) updatePayload.faviconUrl = uploadedFavicon.filename;

        await invalidateOldDrafts(MODULE_NAME, id, t);
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

        return { success: true, isDraft: false, data: settings.get({ plain: true }) };
      }

      // BRANCH 2: Editor (Staging & ERP Sync)
      if (normalizedRole === "editor") {
        if (uploadedLogo) {
          tempLogoPath = this.applyTempPrefix(uploadedLogo);
          updatePayload.logoUrl = tempLogoPath;
        }
        if (uploadedFavicon) {
          tempFaviconPath = this.applyTempPrefix(uploadedFavicon);
          updatePayload.faviconUrl = tempFaviconPath;
        }

        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: NOTRANS_PREFIX,
          action: "UPDATE",
          targetId: id,
          payload: updatePayload,
          recordToLock: settings,
          previousNotrans: previous_notrans,
          successMessage: "Revisi profil diajukan. Data sekarang dikunci.",
        });
      }

      throw new Error("FORBIDDEN: Role Anda tidak valid.");
    } catch (error) {
      if (t && !t.finished) await t.rollback();

      // Rollback physical files if DB operation failed
      if (tempLogoPath) deleteSingleFile(tempLogoPath);
      if (tempFaviconPath) deleteSingleFile(tempFaviconPath);
      if (uploadedLogo && !tempLogoPath) deleteSingleFile(uploadedLogo.filename);
      if (uploadedFavicon && !tempFaviconPath) deleteSingleFile(uploadedFavicon.filename);

      throw error;
    }
  }
}

module.exports = new SettingsService();
