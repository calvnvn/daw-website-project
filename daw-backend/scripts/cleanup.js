const fs = require("fs");
const path = require("path");
const sequelize = require("../config/database");

/**
 * UTILITY: Orphaned Asset Purge
 * Synchronizes the local file system with database references to reclaim storage.
 * Scans production tables, HTML content, and staging drafts.
 */
async function runCleanup() {
  try {
    const validFiles = new Set();

    // Aggregate file references from primary project records and HTML content
    const [projects] = await sequelize.query(
      "SELECT cover_image, gallery, content FROM Projects",
    );
    projects.forEach((p) => {
      if (p.cover_image) validFiles.add(path.basename(p.cover_image));
      if (p.gallery) {
        try {
          const galleryArr =
            typeof p.gallery === "string" ? JSON.parse(p.gallery) : p.gallery;
          if (Array.isArray(galleryArr)) {
            galleryArr.forEach((img) => validFiles.add(path.basename(img)));
          }
        } catch (e) {}
      }
      if (p.content) {
        const regex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
        let match;
        while ((match = regex.exec(p.content)) !== null) {
          validFiles.add(path.basename(match[1]));
        }
      }
    });

    // Map file references from supporting administrative modules
    const extraTables = [
      { table: "Settings", cols: ["logoUrl", "faviconUrl"] },
      { table: "HeroSlides", cols: ["imageUrl"] },
      { table: "Managements", cols: ["photoUrl"] },
      { table: "Affiliates", cols: ["logoUrl"] },
      { table: "ImpactStats", cols: ["icon"] },
      { table: "BusinessMapMarkers", cols: ["mapUrl"] },
    ];

    for (const item of extraTables) {
      try {
        const [rows] = await sequelize.query(
          `SELECT ${item.cols.join(", ")} FROM ${item.table}`,
        );
        rows.forEach((row) => {
          item.cols.forEach((col) => {
            if (row[col]) {
              validFiles.add(path.basename(row[col]));
            }
          });
        });
      } catch (dbErr) {
        console.warn(`⚠️ Skip tabel ${item.table}: ${dbErr.message}`);
      }
    }

    // Recursively scan draft payloads to preserve staged/pending assets
    const [drafts] = await sequelize.query(
      "SELECT payload FROM ApprovalDrafts",
    );
    drafts.forEach((d) => {
      try {
        const payload =
          typeof d.payload === "string" ? JSON.parse(d.payload) : d.payload;
        const scanObject = (obj) => {
          for (const key in obj) {
            if (typeof obj[key] === "string") {
              if (obj[key].match(/\.(jpg|jpeg|png|gif|webp|ico|svg)$/i)) {
                validFiles.add(path.basename(obj[key]));
              }
            } else if (typeof obj[key] === "object" && obj[key] !== null) {
              scanObject(obj[key]);
            }
          }
        };
        scanObject(payload);
      } catch (e) {
        console.warn("⚠️ Gagal parse payload draf untuk cleanup");
      }
    });

    console.log(
      `✅ Ditemukan ${validFiles.size} file gambar yang sedang digunakan di sistem (Termasuk Draf).`,
    );

    // Execute physical deletion of orphaned assets in the uploads directory
    const uploadsDir = path.join(__dirname, "..", "public", "uploads");

    if (!fs.existsSync(uploadsDir)) {
      console.log(`📂 Folder uploads tidak ditemukan di: ${uploadsDir}`);
      process.exit(0);
    }

    const filesInDir = fs.readdirSync(uploadsDir);
    let deletedCount = 0;
    let skippedCount = 0;

    console.log("🚀 Memulai pembersihan...");

    filesInDir.forEach((file) => {
      // Preserve system-critical files and directories
      if (
        file === ".gitkeep" ||
        fs.lstatSync(path.join(uploadsDir, file)).isDirectory()
      ) {
        skippedCount++;
        return;
      }

      // Terminate files not present in the consolidated reference set
      if (!validFiles.has(file)) {
        const filePath = path.join(uploadsDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Dihapus: ${file}`);
          deletedCount++;
        } catch (err) {
          console.error(`❌ Gagal menghapus ${file}:`, err.message);
        }
      }
    });

    console.log(`\n🎉 Proses Selesai!`);
    console.log(`✅ File Aktif: ${validFiles.size}`);
    console.log(`🗑️  File Sampah Dihapus: ${deletedCount}`);
    console.log(`📦 File Sistem Diabaikan: ${skippedCount}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Terjadi kesalahan saat cleanup:", error);
    process.exit(1);
  }
}

runCleanup();
