const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authJwt");
const validate = require("../middleware/validate");
const { loginSchema } = require("../schemas/authSchema");
const { authLimiter } = require("../middleware/rateLimiter");

// PUBLIC
// Authenticate user and synchronize identity
router.post("/login", authLimiter, validate(loginSchema), authController.login);

// AUTHENTICATED
// Fetch session metadata and user profile
router.get("/me", verifyToken, authController.getMe);

module.exports = router;
