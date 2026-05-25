const express = require("express");
const router = express.Router();
const managementController = require("../controllers/managementController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch organizational management and leadership hierarchy
router.get("/", managementController.getAllManagements);

// ADMINISTRATIVE
// Initialize new management member with asset optimization
router.post(
  "/",
  verifyToken,
  checkPermission("manage_about"),
  upload.single("photo"),
  optimizeImage,
  managementController.createManagement,
);

// Mutate management profile data and photo assets
router.put(
  "/:id",
  verifyToken,
  checkPermission("manage_about"),
  upload.single("photo"),
  optimizeImage,
  managementController.updateManagement,
);

// Terminate management record and validate constraints
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_about"),
  managementController.deleteManagement,
);

module.exports = router;
