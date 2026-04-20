const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const uploadPath = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExtensions = /\.(jpg|jpeg|png|gif|webp|ico)$/i;
  const isExtensionValid = allowedExtensions.test(file.originalname);
  const isMimetypeValid =
    file.mimetype.startsWith("image/") || file.mimetype === "image/x-icon";

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

  cb(
    new Error(`File ${file.originalname} bukan format gambar yang didukung!`),
    false,
  );
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

const optimizeImage = async (req, res, next) => {
  if (!req.file && !req.files) return next();

  const processImage = async (file) => {
    const randomSeed = Math.floor(Math.random() * 10000);
    const uniqueSuffix = `${Date.now()}-${randomSeed}`;
    const safeFieldName = file.fieldname.replace(/[^a-zA-Z0-9]/g, "");
    const prefix = req.userRole === "editor" ? "TEMP_" : "";

    const newFilename = `${prefix}${safeFieldName}-${uniqueSuffix}.webp`;

    let pipeline = sharp(file.buffer);

    if (file.fieldname === "favicon") {
      console.log(`>>> [REFINERY] Processing Favicon: Scaling to 64px`);
      pipeline = pipeline
        .resize(64, 64, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90, lossless: true });
    } else if (file.fieldname === "logo") {
      console.log(`>>> [REFINERY] Processing Logo: Trimming and optimizing`);
      pipeline = pipeline
        .trim() // Hapus ruang kosong bawaan file asli
        .resize(1200, null, {
          withoutEnlargement: true,
          fit: "inside",
        })
        .extend({
          top: 40, // Kasih jarak 40px atas
          bottom: 40, // Kasih jarak 40px bawah
          left: 20, // Kasih jarak 20px kiri
          right: 20, // Kasih jarak 20px kanan
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Tetap transparan
        })
        .webp({ quality: 100 }); // Kualitas maksimal untuk aset brand
    } else {
      pipeline = pipeline
        .resize(1920, null, { withoutEnlargement: true, fit: "inside" })
        .webp({ quality: 80 });
    }

    try {
      await pipeline.toFile(path.join(uploadPath, newFilename));
      file.filename = newFilename;
    } catch (err) {
      console.error(
        `🚨 [REFINERY ERROR] Failed processing ${file.originalname}:`,
        err,
      );
      throw err;
    }
  };

  try {
    if (req.file) {
      await processImage(req.file);
    } else if (req.files) {
      const fieldKeys = Object.keys(req.files);
      for (const key of fieldKeys) {
        await Promise.all(req.files[key].map((file) => processImage(file)));
      }
    }
    next();
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengolah aset visual.", error: error.message });
  }
};

module.exports = { upload, optimizeImage };
