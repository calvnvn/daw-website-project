const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const { upload, optimizeImage } = require("../middleware/upload");

// PUBLIC
// Fetch global system configuration and branding metadata
router.get("/", settingsController.getSettings);

// ADMINISTRATIVE
// Mutate system settings and synchronize branding assets
router.put(
  "/",
  [verifyToken, checkPermission("manage_settings")],
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
  ]),
  optimizeImage,
  settingsController.updateSettings,
);

module.exports = router;
