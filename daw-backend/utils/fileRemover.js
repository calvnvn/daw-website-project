const fs = require("fs");
const path = require("path");

exports.removeFile = (fileUrlOrName) => {
  if (!fileUrlOrName) return;

  // path.basename memastikan kita hanya mengambil nama filenya (contoh: "image123.png")
  // baik inputnya berupa "/uploads/image123.png" maupun "image123.png"
  const fileName = path.basename(fileUrlOrName);
  const filePath = path.join(__dirname, "..", "public", "uploads", fileName);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[FILE REMOVED] Berhasil menghapus aset fisik: ${fileName}`);
    }
  } catch (err) {
    console.error(`[FILE ERROR] Gagal menghapus ${fileName}:`, err.message);
  }
};
