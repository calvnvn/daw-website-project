const express = require("express");
const router = express.Router();
const investmentController = require("../controllers/investmentController");
const { upload, optimizeImage } = require("../middleware/upload");

const { verifyToken, checkPermission } = require("../middleware/authJwt");

router.get("/", investmentController.getInvestmentData);

// PUT: Simpan teks (Butuh token keamanan)
router.put(
  "/settings",
  [verifyToken, checkPermission("manage_investments")],
  investmentController.updateSettings,
);

// POST, PUT, DELETE: Kelola afiliasi dan gambar (Butuh token & Multer)
router.post(
  "/affiliate",
  [verifyToken, checkPermission("manage_investments")],
  upload.single("logo"),
  optimizeImage,
  investmentController.createAffiliate,
);
router.put(
  "/affiliate/:id",
  [verifyToken, checkPermission("manage_investments")],
  upload.single("logo"),
  optimizeImage,
  investmentController.updateAffiliate,
);
router.delete(
  "/affiliate/:id",
  [verifyToken, checkPermission("manage_investments")],
  investmentController.deleteAffiliate,
);

module.exports = router;
