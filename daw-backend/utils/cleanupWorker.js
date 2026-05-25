const cron = require("node-cron");
const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("./fileRemover");

/**
 * SCRIPT: Stale Draft Cleanup
 * Automates the permanent removal of discarded approval records and orphaned temporary assets.
 * Execution Frequency: Configurable (Fallback: Weekly on Sunday at 00:00).
 */
const startCleanupTask = () => {
  const cronSchedule = process.env.CRON_CLEANUP_SCHEDULE || "0 0 * * 0";
  // Initialize cron schedule for periodic system maintenance
  cron.schedule(cronSchedule, async () => {
    console.log("🧹 [CRON JOB] Starting database & file cleanup...");

    const retentionDays = parseInt(process.env.DRAFT_RETENTION_DAYS) || 30;
    const expirationDate = new Date(new Date() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      // Aggregate expired records matching the discard status and retention threshold
      const expiredDrafts = await ApprovalDraft.findAll({
        where: {
          status: "Discarded",
          updatedAt: { [Op.lt]: expirationDate },
        },
      });

      if (expiredDrafts.length === 0) {
        return console.log(
          "✨ [CRON JOB] No expired drafts found. Database is clean.",
        );
      }

      console.log(
        `🔍 [CRON JOB] Found ${expiredDrafts.length} expired drafts to purge.`,
      );

      let deletedFilesCount = 0;

      for (const draft of expiredDrafts) {
        // Map asset references from the discarded document payload
        const payload = draft.payload || {};
        const filesToScan = [
          ...(payload._filesToDelete || []),
          payload.cover_image,
          ...(payload.gallery || []),
        ];

        // Execute physical removal of orphaned assets flagged with TEMP prefix
        filesToScan.forEach((fileName) => {
          if (
            fileName &&
            typeof fileName === "string" &&
            fileName.startsWith("TEMP_")
          ) {
            deleteSingleFile(fileName);
            deletedFilesCount++;
          }
        });

        // Terminate database record post-asset cleanup
        await draft.destroy();
      }

      console.log(`✅ [CRON JOB] Cleanup Finished!`);
      console.log(
        `📊 Stats: ${expiredDrafts.length} rows deleted | ${deletedFilesCount} orphan files removed.`,
      );
    } catch (error) {
      console.error("🚨 [CRON JOB ERROR]:", error.message);
    }
  });
};

module.exports = { startCleanupTask };
