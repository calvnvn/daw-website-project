const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/uploads/");
  },
  filename: (req, file, cb) => {
    // Membuat nama file yang unik dan aman
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Kita bersihkan nama field agar tidak ada karakter aneh
    const safeFieldName = file.fieldname.replace(/[^a-zA-Z0-9]/g, "");
    const ext = path.extname(file.originalname);

    cb(null, `${safeFieldName}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // 1. Cek tipe file (Mime-type)
  if (!file.mimetype.startsWith("image/")) {
    // Gunakan Error biasa untuk masalah tipe file.
    return cb(
      new Error("Hanya file gambar (JPG, PNG, dll) yang diizinkan!"),
      false,
    );
  }

  // 2. Filter nama field (Opsional tapi Pro)
  // Memastikan hanya field yang kita kenal yang boleh masuk
  const allowedFields = [
    "cover_image",
    "gallery",
    "inline_image",
    "heroImage",
    "teaser_image",
    "logo",
    "photo",
  ];

  if (allowedFields.includes(file.fieldname)) {
    cb(null, true);
  } else {
    // Jika ada field aneh mencoba upload, baru kita keluarkan MulterError
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    // 🚀 Kita naikkan sedikit ke 15MB karena file kamera modern seringkali besar
    fileSize: 15 * 1024 * 1024,
  },
});

module.exports = upload;
