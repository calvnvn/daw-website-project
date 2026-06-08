const express = require("express");
const router = express.Router();
const philosophyPillarController = require("../controllers/philosophyPillarController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const checkLock = require("../middleware/checkLock");
const PhilosophyPillar = require("../models/PhilosophyPillar");
const validate = require("../middleware/validate");
const { philosophyPillarSchema } = require("../schemas/philosophySchema");

// PUBLIC
// Fetch organizational philosophy pillars and core values
router.get("/", philosophyPillarController.getPillars);

// ADMINISTRATIVE
// Initialize new philosophy pillar record
router.post(
  "/",
  verifyToken,
  checkPermission("manage_about"),
  validate(philosophyPillarSchema),
  philosophyPillarController.createPillar,
);

// Mutate existing philosophy pillar data
router.put(
  "/:id",
  verifyToken,
  checkPermission("manage_about"),
  checkLock(PhilosophyPillar),
  validate(philosophyPillarSchema),
  philosophyPillarController.updatePillar,
);

// Terminate philosophy pillar record and validate dependencies
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_about"),
  checkLock(PhilosophyPillar),
  philosophyPillarController.deletePillar,
);

module.exports = router;
