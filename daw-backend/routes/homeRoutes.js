const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// Public Site
router.get("/", homeController.getHomepageData);

// Protected Site
router.put(
  "/settings",
  [verifyToken, checkPermission("manage_homepage")],
  homeController.updateSettings,
);

// Hero Slides (Protected)
router.post(
  "/hero",
  [verifyToken, checkPermission("manage_homepage")],
  upload.single("image"),
  optimizeImage,
  homeController.createHeroSlide,
);
router.put(
  "/hero/:id",
  [verifyToken, checkPermission("manage_homepage")],
  upload.single("image"),
  optimizeImage,
  homeController.updateHeroSlide,
);
router.delete(
  "/hero/:id",
  [verifyToken, checkPermission("manage_homepage")],
  homeController.deleteHeroSlide,
);

// Impact Stats Route (Protected)
router.post(
  "/stats",
  [verifyToken, checkPermission("manage_homepage")],
  homeController.createStat,
);
router.put(
  "/stats/:id",
  [verifyToken, checkPermission("manage_homepage")],
  homeController.updateStat,
);
router.delete(
  "/stats/:id",
  [verifyToken, checkPermission("manage_homepage")],
  homeController.deleteStat,
);

module.exports = router;
