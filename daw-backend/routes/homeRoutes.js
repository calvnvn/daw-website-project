const express = require("express");
const router = express.Router();
const homeController = require("../controllers/homeController");
const upload = require("../middleware/upload");
const { verifyToken } = require("../middleware/authJwt");

// Public Site
router.get("/", homeController.getHomepageData);

// Protected Site
router.put("/settings", verifyToken, homeController.updateSettings);

// Hero Slides (Protected)
router.post(
  "/hero",
  verifyToken,
  upload.single("image"),
  homeController.createHeroSlide,
);
router.put(
  "/hero/:id",
  verifyToken,
  upload.single("image"),
  homeController.updateHeroSlide,
);
router.delete("/hero/:id", verifyToken, homeController.deleteHeroSlide);

// Impact Stats Route (Protected)
router.post("/stats", verifyToken, homeController.createStat);
router.put("/stats/:id", verifyToken, homeController.updateStat);
router.delete("/stats/:id", verifyToken, homeController.deleteStat);

module.exports = router;
