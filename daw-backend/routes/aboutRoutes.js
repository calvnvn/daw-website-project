const express = require("express");
const router = express.Router();
const aboutController = require("../controllers/aboutController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const validate = require("../middleware/validate");
const { aboutSchema } = require("../schemas/aboutSchema");

// PUBLIC
// Fetch organizational profile information
router.get("/", aboutController.getAboutInfo);

// ADMINISTRATIVE
// Mutate organizational profile and mission data
router.put(
  "/",
  verifyToken,
  checkPermission("manage_about"),
  validate(aboutSchema),
  aboutController.updateAboutInfo,
);

module.exports = router;
