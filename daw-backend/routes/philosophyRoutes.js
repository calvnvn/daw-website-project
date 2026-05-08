const express = require("express");
const router = express.Router();
const philosophyController = require("../controllers/philosophyController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch core organizational philosophy and mission data
router.get("/", philosophyController.getPhilosophy);

// ADMINISTRATIVE
// Mutate core organizational philosophy and values
router.put(
  "/",
  [verifyToken, checkPermission("manage_about")],
  philosophyController.updatePhilosophy,
);

module.exports = router;
