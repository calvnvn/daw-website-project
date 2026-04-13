const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// 1. Simpan di Memory (RAM) agar bisa diproses Sharp sebelum ditulis ke Disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log(
    `[DEBUG UPLOAD] Nama: ${file.originalname} | Mimetype: ${file.mimetype}`,
  );

  const allowedExtensions = /\.(jpg|jpeg|png|gif|webp)$/i;
  const isExtensionValid = allowedExtensions.test(file.originalname);
  const isMimetypeValid = file.mimetype.startsWith("image/");

  if (isExtensionValid || isMimetypeValid) {
    const allowedFields = [
      "image",
      "cover_image",
      "gallery",
      "inline_image",
      "heroImage",
      "teaser_image",
      "logo",
      "favicon",
      "photo",
    ];

    if (allowedFields.includes(file.fieldname)) {
      return cb(null, true);
    } else {
      return cb(
        new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname),
        false,
      );
    }
  }

  // Jika dua-duanya gagal, baru kita usir
  cb(
    new Error(`File ${file.originalname} tidak dikenal sebagai gambar!`),
    false,
  );
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// 2. Middleware Utama untuk Kompresi & Resize
const optimizeImage = async (req, res, next) => {
  // Jika tidak ada file, lanjut ke controller
  if (!req.file && !req.files) return next();

  const uploadPath = path.join(process.cwd(), "public", "uploads");

  // Helper Fungsi untuk memproses gambar
  const processImage = async (file) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeFieldName = file.fieldname.replace(/[^a-zA-Z0-9]/g, "");

    // 🔴 Gatekeeper: Cek Role dari JWT (req.userRole diset di authJwt.js)
    const prefix = req.userRole === "Editor" ? "TEMP_" : "";

    // Paksa ekstensi jadi .webp untuk kompresi terbaik
    const newFilename = `${prefix}${safeFieldName}-${uniqueSuffix}.webp`;

    await sharp(file.buffer)
      .resize(1920, null, {
        // Resize lebar maks 1920px, tinggi otomatis (rasio terjaga)
        withoutEnlargement: true, // Jangan paksa besarkan jika gambar aslinya kecil
        fit: "inside",
      })
      .webp({ quality: 80 }) // Konversi ke WebP, kualitas 80% (seimbang tajam & ringan)
      .toFile(path.join(uploadPath, newFilename));

    // TIMPANI properti file agar Controller menerima nama file yang baru (.webp)
    file.filename = newFilename;
  };

  try {
    if (req.file) {
      // Kasus Single File (misal: logo, favicon)
      await processImage(req.file);
    } else if (req.files) {
      // Kasus Multiple Fields (misal: cover_image + gallery)
      const fields = Object.keys(req.files);
      for (const field of fields) {
        await Promise.all(req.files[field].map((file) => processImage(file)));
      }
    }
    next();
  } catch (error) {
    console.error("🚨 Sharp Optimization Error:", error);
    res.status(500).json({ message: "Gagal memproses gambar." });
  }
};

module.exports = { upload, optimizeImage };
