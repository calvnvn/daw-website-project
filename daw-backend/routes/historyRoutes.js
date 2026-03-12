const express = require("express");
const router = express.Router();
const historyController = require("../controllers/historyController");
const { verifyToken } = require("../middleware/authJwt");

// 1. Public SIte
router.get("/", historyController.getHistories);

// 2. Protected Site
router.put("/", verifyToken, historyController.updateHistories);

module.exports = router;
