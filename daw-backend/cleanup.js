// daw-backend/cleanup.js
const fs = require("fs");
const path = require("path");
const sequelize = require("./config/database");

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

      // Masukkan gallery (parse JSON)
      if (p.gallery) {
        try {
          const galleryArr = JSON.parse(p.gallery);
          galleryArr.forEach((img) => validFiles.add(path.basename(img)));
        } catch (e) {}
      }

      // Masukkan inline images (gambar dari dalam artikel Quill)
      if (p.content) {
        const regex = /\/uploads\/([^"'\s>]+)/g;
        let match;
        while ((match = regex.exec(p.content)) !== null) {
          validFiles.add(path.basename(match[1])); // Ambil nama filenya saja
        }
      }
    });

    // 2. Cek Tabel HeroSlides
    const [slides] = await sequelize.query("SELECT imageUrl FROM HeroSlides");
    slides.forEach((s) => {
      if (s.imageUrl) validFiles.add(path.basename(s.imageUrl));
    });

    // 3. Cek Tabel Managements
    const [managements] = await sequelize.query(
      "SELECT photoUrl FROM Managements",
    );
    managements.forEach((m) => {
      if (m.photoUrl) validFiles.add(path.basename(m.photoUrl));
    });

    // 4. Cek Tabel Affiliates
    const [affiliates] = await sequelize.query(
      "SELECT logoUrl FROM Affiliates",
    );
    affiliates.forEach((a) => {
      if (a.logoUrl) validFiles.add(path.basename(a.logoUrl));
    });

    console.log(
      `✅ Ditemukan ${validFiles.size} file gambar yang sedang digunakan di sistem.`,
    );

    // 5. Eksekusi Penghapusan di Folder
    const uploadsDir = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      console.log("📂 Folder uploads tidak ditemukan.");
      process.exit(0);
    }

    const filesInDir = fs.readdirSync(uploadsDir);
    let deletedCount = 0;

    filesInDir.forEach((file) => {
      if (file === ".gitkeep") return; // Abaikan file sistem

      // Jika file di folder TIDAK ADA di dalam Set validFiles -> HAPUS
      if (!validFiles.has(file)) {
        const filePath = path.join(uploadsDir, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️ Dihapus (File Sampah): ${file}`);
        deletedCount++;
      }
    });

    console.log(
      `\n🎉 Proses Selesai! Berhasil membersihkan ${deletedCount} file sampah dari server.`,
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Terjadi kesalahan saat cleanup:", error);
    process.exit(1);
  }
}

runCleanup();
