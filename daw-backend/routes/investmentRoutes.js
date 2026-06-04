const express = require("express");
const router = express.Router();
const investmentController = require("../controllers/investmentController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch public investment portfolio and affiliate data (nested by category)
router.get("/public", investmentController.getPublicInvestmentData);

// ADMINISTRATIVE
// Retrieve comprehensive investment registry and audit metadata
router.get("/admin", verifyToken, investmentController.getAdminInvestmentData);

// ==========================================
// CATEGORY MANAGEMENT
// ==========================================

// Retrieve all categories (public, used by CMS dropdown & frontend rendering)
router.get("/categories", investmentController.getCategories);

// Create a new investment category
router.post(
  "/categories",
  verifyToken,
  checkPermission("manage_investments"),
  investmentController.createCategory,
);

// Update an existing investment category
router.put(
  "/categories/:id",
  verifyToken,
  checkPermission("manage_investments"),
  investmentController.updateCategory,
);

// Delete an investment category (only if no affiliates are linked)
router.delete(
  "/categories/:id",
  verifyToken,
  checkPermission("manage_investments"),
  investmentController.deleteCategory,
);

// ==========================================
// SETTINGS
// ==========================================

// Mutate global investment textual configuration
router.put(
  "/settings",
  verifyToken,
  checkPermission("manage_investments"),
  investmentController.updateSettings,
);

// ==========================================
// AFFILIATE MANAGEMENT
// ==========================================

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
