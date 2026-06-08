const express = require("express");
const router = express.Router();
const achievementController = require("../controllers/achievementController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const checkLock = require("../middleware/checkLock");
const Achievement = require("../models/Achievement");
const { upload, optimizeImage } = require("../middleware/upload");
const validate = require("../middleware/validate");
const { createAchievementSchema, updateAchievementSchema } = require("../schemas/achievementSchema");

/**
 * ACHIEVEMENT ROUTES
 * Base URL: /api/achievements
 */

// PUBLIC
// Fetch all achievements in descending order
router.get("/", achievementController.getAllAchievements);

// Fetch a single achievement by its primary key
router.get("/:id", achievementController.getAchievementById);

// ADMINISTRATIVE
// Create a new achievement record with optional image asset upload
router.post(
  "/",
  verifyToken,
  checkPermission("manage_achievements"),
  upload.single("image"),
  validate(createAchievementSchema),
  optimizeImage,
  achievementController.createAchievement,
);

// Update an existing achievement record with optional image asset upload or removal
router.put(
  "/:id",
  verifyToken,
  checkPermission("manage_achievements"),
  checkLock(Achievement),
  upload.single("image"),
  validate(updateAchievementSchema),
  optimizeImage,
  achievementController.updateAchievement,
);

// Delete an achievement record and physically purge its associated assets
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_achievements"),
  checkLock(Achievement),
  achievementController.deleteAchievement,
);

module.exports = router;
