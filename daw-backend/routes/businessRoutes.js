const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");
const { verifyToken } = require("../middleware/authJwt");

// Public Site
router.get("/public", businessController.getPublicBusinessData);

// Private Site
router.put("/admin/:id", verifyToken, businessController.updateBusinessSection);

module.exports = router;
