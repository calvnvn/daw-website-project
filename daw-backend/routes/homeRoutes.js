const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// --- 1. Public Site ---
router.get("/", [verifyToken], homeController.getHomepageData);

// --- 2. Home Intro Settings (Singleton) ---
router.put(
  "/settings",
  [verifyToken, checkPermission("manage_homepage")],
  upload.none(),
  homeController.updateSettings,
);

// --- 3. Hero Slides (Collection with Assets) ---
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

// --- 4. Impact Stats (Collection - Text Only) ---
router.post(
  "/stats",
  [verifyToken, checkPermission("manage_homepage")],
  upload.none(),
  homeController.createStat,
);

router.put(
  "/stats/:id",
  [verifyToken, checkPermission("manage_homepage")],
  upload.none(),
  homeController.updateStat,
);

router.delete(
  "/stats/:id",
  [verifyToken, checkPermission("manage_homepage")],
  homeController.deleteStat,
);

module.exports = router;
