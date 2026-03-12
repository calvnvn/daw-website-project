const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");
const { verifyToken } = require("../middleware/authJwt");

// 1. Public SIte
router.get("/", settingsController.getSettings);

// 2. Protected Site
router.put("/", verifyToken, settingsController.updateSettings);

module.exports = router;
