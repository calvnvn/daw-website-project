const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const checkLock = require("../middleware/checkLock");
const HomeSettings = require("../models/HomeSettings");
const HeroSlides = require("../models/HeroSlides");
const ImpactStats = require("../models/ImpactStats");
const validate = require("../middleware/validate");
const { heroSchema, statSchema } = require("../schemas/homeSchema");

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
  checkLock(HomeSettings),
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
  validate(heroSchema),
  homeController.createHeroSlide,
);

// Mutate hero slide data and assets
router.put(
  "/hero/:id",
  verifyToken,
  checkPermission("manage_homepage"),
  checkLock(HeroSlides),
  upload.single("image"),
  optimizeImage,
  validate(heroSchema),
  homeController.updateHeroSlide,
);

// Terminate hero slide record
router.delete(
  "/hero/:id",
  verifyToken,
  checkPermission("manage_homepage"),
  checkLock(HeroSlides),
  homeController.deleteHeroSlide,
);

// Initialize impact statistic record
router.post(
  "/stats",
  verifyToken,
  checkPermission("manage_homepage"),
  upload.none(),
  validate(statSchema),
  homeController.createStat,
);

// Mutate impact statistic data
router.put(
  "/stats/:id",
  verifyToken,
  checkPermission("manage_homepage"),
  checkLock(ImpactStats),
  upload.none(),
  validate(statSchema),
  homeController.updateStat,
);

// Terminate impact statistic record
router.delete(
  "/stats/:id",
  verifyToken,
  checkPermission("manage_homepage"),
  checkLock(ImpactStats),
  homeController.deleteStat,
);

module.exports = router;
