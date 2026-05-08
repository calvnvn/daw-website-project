const fs = require("fs");
const path = require("path");

/**
 * UTILITY: Temp Asset Promotion
 * Facilitates the transition of staged temporary files to permanent storage by stripping designated prefixes and managing file system collisions.
 */
const commitTempFile = (fileInput) => {
  // INITIALIZATION
  // Validate input presence and derive base filename
  if (!fileInput) return fileInput;

  const filename = path.basename(fileInput);
  // Bypass processing if the filename lacks the temporary prefix
  if (!filename.startsWith("TEMP_")) return filename;

  // REFERENCE GATHERING
  // Map absolute directory paths and resolve target identities
  const uploadPath = path.join(__dirname, "..", "public", "uploads");
  const oldPath = path.join(uploadPath, filename);

  const newFilename = filename.replace(/^TEMP_/, "");
  const newPath = path.join(uploadPath, newFilename);

  // EXECUTION
  try {
    // Verify physical presence of the source asset on disk
    if (fs.existsSync(oldPath)) {
      // Mitigate destination collisions by purging existing assets
      if (fs.existsSync(newPath)) {
        try {
          fs.unlinkSync(newPath);
        } catch (err) {
          console.warn(
            `[FILE MANAGER] Gagal menghapus file lama ${newFilename}, menimpa...`,
          );
        }
      }

      // Execute file system promotion via atomic rename operation
      fs.renameSync(oldPath, newPath);
      console.log(`✅ [FILE COMMITTED] ${filename} -> ${newFilename}`);
      return newFilename;
    } else {
      console.error(`🚨 [PROMOTION FAIL] File ${filename} raib dari disk!`);
      return filename;
    }
  } catch (error) {
    console.error(`🚨 [FILE COMMIT ERROR]:`, error.message);
    return filename;
  }
};

module.exports = { commitTempFile };
