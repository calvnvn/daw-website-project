const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch aggregated homepage metadata
router.get("/public", homeController.getPublicHomepageData);

// ADMINISTRATIVE
// Fetch comprehensive admin dashboard data
router.get("/admin", verifyToken, homeController.getAdminHomepageData);

// Mutate singleton homepage configuration
router.put(
  "/settings",
  verifyToken,
  checkPermission("manage_homepage"),
  upload.none(),
  homeController.updateSettings,
);

// Initialize hero slide with asset optimization
router.post(
  "/hero",
  verifyToken,
  checkPermission("manage_homepage"),
  upload.single("image"),
  optimizeImage,
  homeController.createHeroSlide,
);

// Mutate hero slide data and assets
router.put(
  "/hero/:id",
  verifyToken,
  checkPermission("manage_homepage"),
  upload.single("image"),
  optimizeImage,
  homeController.updateHeroSlide,
);

// Terminate hero slide record
router.delete(
  "/hero/:id",
  verifyToken,
  checkPermission("manage_homepage"),
  homeController.deleteHeroSlide,
);

// Initialize impact statistic record
router.post(
  "/stats",
  verifyToken,
  checkPermission("manage_homepage"),
  upload.none(),
  homeController.createStat,
);

// Mutate impact statistic data
router.put(
  "/stats/:id",
  verifyToken,
  checkPermission("manage_homepage"),
  upload.none(),
  homeController.updateStat,
);

// Terminate impact statistic record
router.delete(
  "/stats/:id",
  verifyToken,
  checkPermission("manage_homepage"),
  homeController.deleteStat,
);

module.exports = router;
