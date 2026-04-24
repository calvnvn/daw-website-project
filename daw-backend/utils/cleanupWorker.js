const cron = require("node-cron");
const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("./fileRemover");

/**
 * THE ULTIMATE GARBAGE COLLECTOR
 * Berjalan setiap Minggu jam 00:00
 */
const startCleanupTask = () => {
  // Pattern: Menit Detik Jam HariBulan Bulan HariMinggu
  // "0 0 * * 0" = Setiap hari Minggu jam 00:00
  cron.schedule("0 0 * * 0", async () => {
    console.log("🧹 [CRON JOB] Starting weekly database & file cleanup...");

    const thirtyDaysAgo = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);

    try {
      // 1. Cari draf yang statusnya Discarded dan sudah berumur > 30 hari
      const expiredDrafts = await ApprovalDraft.findAll({
        where: {
          status: "Discarded",
          updatedAt: { [Op.lt]: thirtyDaysAgo },
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
        // 2. Berburu file fisik di dalam payload (karena draf dibuang, file TEMP_ nggak akan pernah jadi permanen)
        const payload = draft.payload || {};

        // Cek file di field khusus _filesToDelete atau scan string yang depannya TEMP_
        const filesToScan = [
          ...(payload._filesToDelete || []),
          payload.cover_image,
          ...(payload.gallery || []),
        ];

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

        // 3. Hapus record dari database permanen
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
