const express = require("express");
const router = express.Router();
const investmentController = require("../controllers/investmentController");
const upload = require("../middleware/upload");

const { verifyToken } = require("../middleware/authJwt");

router.get("/", investmentController.getInvestmentData);

// PUT: Simpan teks (Butuh token keamanan)
router.put("/settings", verifyToken, investmentController.updateSettings);

// POST, PUT, DELETE: Kelola afiliasi dan gambar (Butuh token & Multer)
router.post(
  "/affiliate",
  verifyToken,
  upload.single("logo"),
  investmentController.createAffiliate,
);
router.put(
  "/affiliate/:id",
  verifyToken,
  upload.single("logo"),
  investmentController.updateAffiliate,
);
router.delete(
  "/affiliate/:id",
  verifyToken,
  investmentController.deleteAffiliate,
);

module.exports = router;
