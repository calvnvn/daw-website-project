const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authJwt");

// PUBLIC
// Authenticate user and synchronize identity
router.post("/login", authController.login);

// AUTHENTICATED
// Fetch session metadata and user profile
router.get("/me", verifyToken, authController.getMe);

module.exports = router;
