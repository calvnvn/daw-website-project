const express = require("express");
const router = express.Router();
const investmentController = require("../controllers/investmentController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch public investment portfolio and affiliate data
router.get("/public", investmentController.getPublicInvestmentData);

// ADMINISTRATIVE
// Retrieve comprehensive investment registry and audit metadata
router.get("/admin", verifyToken, investmentController.getAdminInvestmentData);

// Mutate global investment textual configuration
router.put(
  "/settings",
  verifyToken,
  checkPermission("manage_investments"),
  investmentController.updateSettings,
);

// Initialize new affiliate record with asset optimization
router.post(
  "/affiliates",
  verifyToken,
  checkPermission("manage_investments"),
  upload.single("logo"),
  optimizeImage,
  investmentController.createAffiliate,
);

// Mutate affiliate profile and logo assets
router.put(
  "/affiliates/:id",
  verifyToken,
  checkPermission("manage_investments"),
  upload.single("logo"),
  optimizeImage,
  investmentController.updateAffiliate,
);

// Terminate affiliate record and validate dependencies
router.delete(
  "/affiliates/:id",
  verifyToken,
  checkPermission("manage_investments"),
  investmentController.deleteAffiliate,
);

module.exports = router;
