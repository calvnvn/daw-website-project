const express = require("express");
const router = express.Router();
const philosophyController = require("../controllers/philosophyController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const checkLock = require("../middleware/checkLock");
const Philosophy = require("../models/Philosophy");
const validate = require("../middleware/validate");
const { philosophySchema } = require("../schemas/philosophySchema");

// PUBLIC
// Fetch core organizational philosophy and mission data
router.get("/", philosophyController.getPhilosophy);

// ADMINISTRATIVE
// Mutate core organizational philosophy and values
router.put(
  "/",
  verifyToken,
  checkPermission("manage_philosophy"),
  checkLock(Philosophy),
  validate(philosophySchema),
  philosophyController.updatePhilosophy,
);

module.exports = router;
