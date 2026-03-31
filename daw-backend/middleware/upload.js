const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Pastikan folder ini sudah kamu buat secara fisik!
    cb(null, "./public/uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeFieldName = file.fieldname.replace(/[^a-zA-Z0-9]/g, "");
    const ext = path.extname(file.originalname);

    cb(null, `${safeFieldName}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // 1. Cek tipe file (Mime-type)
  // image/png, image/jpeg, image/x-icon (untuk .ico)
  if (!file.mimetype.startsWith("image/")) {
    return cb(
      new Error("Hanya file gambar (JPG, PNG, ICO, dll) yang diizinkan!"),
      false,
    );
  }

  // 2. Filter nama field
  const allowedFields = [
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
    cb(null, true);
  } else {
    // Kalau field name dari frontend tidak ada di list atas, dia nolak
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
});

module.exports = upload;
