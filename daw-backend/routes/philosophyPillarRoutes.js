const express = require("express");
const router = express.Router();
const philosophyPillarController = require("../controllers/philosophyPillarController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// 1. GET ALL PILLARS (Public/Shared)
router.get("/", philosophyPillarController.getPillars);

// 2. CREATE NEW PILLAR (Protected)
router.post(
  "/",
  [verifyToken, checkPermission("manage_about")],
  philosophyPillarController.createPillar,
);

// 3. UPDATE SPECIFIC PILLAR (Protected)
router.put(
  "/:id",
  [verifyToken, checkPermission("manage_about")],
  philosophyPillarController.updatePillar,
);

// 4. DELETE SPECIFIC PILLAR (Protected)
router.delete(
  "/:id",
  [verifyToken, checkPermission("manage_about")],
  philosophyPillarController.deletePillar,
);

module.exports = router;
