const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Ensure target directory exists for persistent asset storage
const uploadPath = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Initialize memory storage to prevent disk clutter before optimization
const storage = multer.memoryStorage();

/**
 * Validates incoming files based on extension, mimetype, and approved CMS field names
 */
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

    // Restrict uploads to predefined database-mapped fields
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

// Configure Multer with dynamic size limit from environment variables (fallback: 15MB)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB) || 15) * 1024 * 1024 },
});

/**
 * Middleware: Performs asynchronous image transformation, format conversion (WebP), and staging logic
 */
const optimizeImage = async (req, res, next) => {
  if (!req.file && !req.files) return next();

  // Internal processor for single file buffers
  const processImage = async (file) => {
    const randomSeed = Math.floor(Math.random() * 10000);
    const uniqueSuffix = `${Date.now()}-${randomSeed}`;
    const safeFieldName = file.fieldname.replace(/[^a-zA-Z0-9]/g, "");

    // Implement Staging Logic: Prefix files from non-privileged roles to prevent auto-publishing
    const prefix = req.userRole === "editor" ? "TEMP_" : "";
    const newFilename = `${prefix}${safeFieldName}-${uniqueSuffix}.webp`;

    let pipeline = sharp(file.buffer);

    // Context-Aware Processing: Favicon (64px, Lossless)
    if (file.fieldname === "favicon") {
      // console.log(`>>> [REFINERY] Processing Favicon: Scaling to 64px`);
      pipeline = pipeline
        .resize(64, 64, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90, lossless: true });
    }
    // Context-Aware Processing: Logo (Trim, Resize, and Padding)
    else if (file.fieldname === "logo") {
      // console.log(`>>> [REFINERY] Processing Logo: Trimming and optimizing`);
      pipeline = pipeline
        .trim()
        .resize(1200, null, {
          withoutEnlargement: true,
          fit: "inside",
        })
        .extend({
          top: 40,
          bottom: 40,
          left: 20,
          right: 20,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 100 });
    }
    // Context-Aware Processing: Standard Assets (1920px Max, Compressed WebP)
    else {
      pipeline = pipeline
        .resize(1920, null, { withoutEnlargement: true, fit: "inside" })
        .webp({ quality: 80 });
    }

    try {
      // Commit optimized buffer to disk as WebP
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
    // Handle both single (upload.single) and multiple (upload.fields/array) file objects
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
