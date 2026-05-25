const express = require("express");
const router = express.Router();
const aboutController = require("../controllers/aboutController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch organizational profile information
router.get("/", aboutController.getAboutInfo);

// ADMINISTRATIVE
// Mutate organizational profile and mission data
router.put(
  "/",
  verifyToken,
  checkPermission("manage_about"),
  aboutController.updateAboutInfo,
);

module.exports = router;
