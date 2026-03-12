const express = require("express");
const router = express.Router();
const aboutController = require("../controllers/aboutController");
const { verifyToken } = require("../middleware/authJwt");

// 1. Public Route
router.get("/", aboutController.getAboutInfo);

// 2. Protected Route
router.put("/", verifyToken, aboutController.updateAboutInfo);

module.exports = router;
