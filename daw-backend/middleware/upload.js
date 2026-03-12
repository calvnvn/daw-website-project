const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/uploads/");
  },
  filename: (req, file, cb) => {
    // FIX: Hanya panggil SATU KALI cb()
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName =
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname);
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  // FIX: Hapus deklarasi ganda, gunakan satu logika filter yang solid
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Only image files are allowed!",
      ),
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Maksimal 10MB PER GAMBAR
  },
});

module.exports = upload;
