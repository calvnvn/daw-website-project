const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const { upload, optimizeImage } = require("../middleware/upload");

// PUBLIC
// Fetch business data and map coordinates for public access
router.get("/public", businessController.getPublicBusinessData);

// ADMINISTRATIVE
// Retrieve comprehensive business registry
router.get(
  "/admin",
  verifyToken,
  checkPermission("manage_businesses"),
  businessController.getAdminBusinessSections,
);

// Initialize new business section
router.post(
  "/admin",
  verifyToken,
  checkPermission("manage_businesses"),
  businessController.createBusinessSection,
);

// Mutate business data and markers
router.put(
  "/admin/:id",
  verifyToken,
  checkPermission("manage_businesses"),
  businessController.updateBusinessSection,
);

// Terminate business record and validate constraints
router.delete(
  "/admin/:id",
  verifyToken,
  checkPermission("manage_businesses"),
  businessController.deleteSection,
);

// Execute image upload and optimization pipeline
router.post(
  "/admin/upload-image",
  verifyToken,
  checkPermission("manage_businesses"),
  upload.single("image"),
  optimizeImage,
  businessController.uploadBusinessImage,
);

module.exports = router;
