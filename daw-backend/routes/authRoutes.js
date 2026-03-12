const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { verifyToken } = require("../middleware/authJwt");

/**
 * @swagger
 * /api/auth/login:
 * post:
 * summary: User login
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * username:
 * password:
 * type: string
 * type: string
 * responses:
 * 200:
 * description: Login successful
 */
router.post("/login", authController.login);
router.get("/me", verifyToken, authController.getMe);

router.post(
  "/force-change-password",
  verifyToken,
  authController.forceChangePassword,
);
module.exports = router;
