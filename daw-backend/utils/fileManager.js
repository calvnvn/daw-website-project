const fs = require("fs");
const path = require("path");

/**
 * Mengubah status file dari TEMP menjadi Permanen secara aman.
 * @param {string} fileInput - Bisa berupa nama file saja atau URL lengkap
 * @returns {string} Nama file yang baru (sudah permanen)
 */
const commitTempFile = (fileInput) => {
  if (!fileInput) return fileInput;

  const filename = path.basename(fileInput);

  if (!filename.startsWith("TEMP_")) return filename;

  const uploadPath = path.join(process.cwd(), "public", "uploads");
  const oldPath = path.join(uploadPath, filename);

  const newFilename = filename.replace(/^TEMP_/, "");
  const newPath = path.join(uploadPath, newFilename);

  try {
    if (fs.existsSync(oldPath)) {
      
      if (fs.existsSync(newPath) && oldPath !== newPath) {
        fs.unlinkSync(newPath);
      }

      fs.renameSync(oldPath, newPath);
      
      console.log(`✅ [FILE COMMITTED] ${filename} -> ${newFilename}`);
      return newFilename;
    } else {
      console.warn(`⚠️ [FILE NOT FOUND] ${filename} tidak ada di folder uploads. Mungkin sudah permanen?`);
      return newFilename; 
    }
  } catch (error) {
    console.error(`🚨 [FILE COMMIT ERROR] Gagal merename ${filename}:`, error.message);
    return filename; 
  }
};

module.exports = { commitTempFile };