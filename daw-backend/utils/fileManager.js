const fs = require("fs");
const path = require("path");

const commitTempFile = (fileInput) => {
  if (!fileInput) return fileInput;

  const filename = path.basename(fileInput);
  if (!filename.startsWith("TEMP_")) return filename;

  const uploadPath = path.resolve(process.cwd(), "public", "uploads");
  const oldPath = path.join(uploadPath, filename);

  const newFilename = filename.replace(/^TEMP_/, "");
  const newPath = path.join(uploadPath, newFilename);

  try {
    if (fs.existsSync(oldPath)) {
      if (fs.existsSync(newPath)) {
        try {
          fs.unlinkSync(newPath);
        } catch (err) {
          console.warn(
            `[FILE MANAGER] Gagal menghapus file lama ${newFilename}, menimpa...`,
          );
        }
      }

      fs.renameSync(oldPath, newPath);
      console.log(`✅ [FILE COMMITTED] ${filename} -> ${newFilename}`);
      return newFilename;
    } else {
      console.error(
        `🚨 [PROMOTION CRITICAL] File FISIK ${filename} tidak ditemukan di ${uploadPath}!`,
      );
      return null;
    }
  } catch (error) {
    console.error(
      `🚨 [FILE COMMIT ERROR] Gagal merename ${filename}:`,
      error.message,
    );
    return null;
  }
};

module.exports = { commitTempFile };
