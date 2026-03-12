const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { verifyToken } = require("../middleware/authJwt");

// Endpoint: GET http://localhost:5000/api/dashboard/stats
router.get("/stats", verifyToken, dashboardController.getDashboardStats);

module.exports = router;
