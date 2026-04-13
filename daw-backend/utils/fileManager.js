const fs = require("fs");
const path = require("path");

/**
 * Mengubah status file dari TEMP menjadi Permanen.
 * Contoh: "TEMP_cover-123.webp" -> "cover-123.webp"
 * @param {string} filename Nama file saat ini
 * @returns {string} Nama file yang baru (sudah permanen)
 */

const commitTempFile = (filename) => {
  if (!filename || !filename.startsWith("TEMP_")) return filename;

  const uploadPath = path.join(process.cwd(), "public", "uploads");
  const oldPath = path.join(uploadPath, filename);

  // Delete "TEMP_" (5W)
  const newFilename = filename.substring(5);
  const newPath = path.join(uploadPath, newFilename);

  try {
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`✅ [FILE COMMITTED] ${filename} -> ${newFilename}`);
    }
  } catch (error) {
    console.error(`🚨 [FILE COMMIT ERROR] Gagal merename ${filename}:`, error);
  }

  return newFilename;
};

module.exports = { commitTempFile };
