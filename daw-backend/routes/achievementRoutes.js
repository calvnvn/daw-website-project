const express = require("express");
const router = express.Router();
const achievementController = require("../controllers/achievementController");
const { verifyToken } = require("../middleware/authJwt");
const { upload, optimizeImage } = require("../middleware/upload");

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
  upload.single("image"),
  optimizeImage,
  achievementController.createAchievement,
);

// Update an existing achievement record with optional image asset upload or removal
router.put(
  "/:id",
  verifyToken,
  upload.single("image"),
  optimizeImage,
  achievementController.updateAchievement,
);

// Delete an achievement record and physically purge its associated assets
router.delete("/:id", verifyToken, achievementController.deleteAchievement);

module.exports = router;
