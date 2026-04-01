const fs = require("fs");
const path = require("path");

const deleteSingleFile = (fileName) => {
  if (!fileName) return;

  // Ambil hanya nama filenya saja (mengantisipasi jika yang dikirim adalah URL lengkap)
  const baseName = path.basename(fileName);
  const filePath = path.join(process.cwd(), "public", "uploads", baseName);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️  Auto-Deleted: ${baseName}`);
    } catch (err) {
      console.error(`❌ Gagal menghapus file ${baseName}:`, err.message);
    }
  }
};

module.exports = { deleteSingleFile };
