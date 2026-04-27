const express = require("express");
const router = express.Router();
const investmentController = require("../controllers/investmentController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// 1. PUBLIC ENDPOINTS (No Auth Required)
router.get("/public", investmentController.getPublicInvestmentData);

// 2. ADMIN ENDPOINTS (Auth Required)
router.get(
  "/admin",
  [verifyToken],
  investmentController.getAdminInvestmentData,
);

router.put(
  "/settings",
  [verifyToken, checkPermission("manage_investments")],
  investmentController.updateSettings,
);

// 3. AFFILIATES MANAGEMENT

// CREATE
router.post(
  "/affiliates",
  [verifyToken, checkPermission("manage_investments")],
  upload.single("logo"),
  optimizeImage,
  investmentController.createAffiliate,
);

// UPDATE
router.put(
  "/affiliates/:id",
  [verifyToken, checkPermission("manage_investments")],
  upload.single("logo"),
  optimizeImage,
  investmentController.updateAffiliate,
);

// DELETE
router.delete(
  "/affiliates/:id",
  [verifyToken, checkPermission("manage_investments")],
  investmentController.deleteAffiliate,
);

module.exports = router;
