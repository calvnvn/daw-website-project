const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const { upload, optimizeImage } = require("../middleware/upload");

// 1. Public SIte
router.get("/", settingsController.getSettings);

// 2. Protected Site (Gunakan upload.fields)
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
