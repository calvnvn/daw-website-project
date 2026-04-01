// daw-backend/scripts/cleanup.js
const fs = require("fs");
const path = require("path");
const sequelize = require("../config/database");

async function runCleanup() {
  try {
    console.log("🔍 Memulai pemindaian database untuk file aktif...");
    const validFiles = new Set();

    // 1. Cek Tabel Projects (Cover, Gallery, dan Inline Content)
    const [projects] = await sequelize.query(
      "SELECT cover_image, gallery, content FROM Projects",
    );

    projects.forEach((p) => {
      // Masukkan cover_image
      if (p.cover_image) validFiles.add(path.basename(p.cover_image));

      // Masukkan gallery
      if (p.gallery) {
        try {
          // Sequelize kadang mengembalikan string, kadang sudah jadi array objek
          const galleryArr =
            typeof p.gallery === "string" ? JSON.parse(p.gallery) : p.gallery;
          if (Array.isArray(galleryArr)) {
            galleryArr.forEach((img) => validFiles.add(path.basename(img)));
          }
        } catch (e) {
          console.warn("⚠️ Gagal parse gallery untuk salah satu project");
        }
      }

      // Masukkan inline images (gambar dari Quill)
      if (p.content) {
        // Regex yang lebih kuat untuk menangkap nama file di folder uploads
        const regex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
        let match;
        while ((match = regex.exec(p.content)) !== null) {
          validFiles.add(path.basename(match[1]));
        }
      }
    });

    // 2, 3, 4. (HeroSlides, Managements, Affiliates) - Tetap sama
    const tableQueries = [
      { table: "HeroSlides", col: "imageUrl" },
      { table: "Managements", col: "photoUrl" },
      { table: "Affiliates", col: "logoUrl" },
    ];

    for (const item of tableQueries) {
      const [rows] = await sequelize.query(
        `SELECT ${item.col} FROM ${item.table}`,
      );
      rows.forEach((row) => {
        if (row[item.col]) validFiles.add(path.basename(row[item.col]));
      });
    }

    console.log(
      `✅ Ditemukan ${validFiles.size} file gambar yang sedang digunakan di sistem.`,
    );

    // --- FIX PATH DI SINI ---
    // Jika script di: daw-backend/scripts/cleanup.js
    // Folder upload di: daw-backend/public/uploads
    // Maka kita butuh ".." untuk naik satu level ke root
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
      // Abaikan file sistem atau folder
      if (
        file === ".gitkeep" ||
        fs.lstatSync(path.join(uploadsDir, file)).isDirectory()
      ) {
        skippedCount++;
        return;
      }

      // HAPUS jika tidak ada di database
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
