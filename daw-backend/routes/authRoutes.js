const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authJwt");

router.post("/login", authController.login);

router.post(
  "/force-change-password",
  verifyToken,
  authController.forceChangePassword,
);
router.post("/reset-password/:token", authController.resetPassword);
router.post("/forgot-password", authController.forgotPassword);
router.get("/me", verifyToken, authController.getMe);

module.exports = router;
