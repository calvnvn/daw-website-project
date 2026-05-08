const express = require("express");
const router = express.Router();
const philosophyPillarController = require("../controllers/philosophyPillarController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch organizational philosophy pillars and core values
router.get("/", philosophyPillarController.getPillars);

// ADMINISTRATIVE
// Initialize new philosophy pillar record
router.post(
  "/",
  [verifyToken, checkPermission("manage_about")],
  philosophyPillarController.createPillar,
);

// Mutate existing philosophy pillar data
router.put(
  "/:id",
  [verifyToken, checkPermission("manage_about")],
  philosophyPillarController.updatePillar,
);

// Terminate philosophy pillar record and validate dependencies
router.delete(
  "/:id",
  [verifyToken, checkPermission("manage_about")],
  philosophyPillarController.deletePillar,
);

module.exports = router;
