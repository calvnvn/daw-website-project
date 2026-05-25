const express = require("express");
const router = express.Router();
const historyController = require("../controllers/historyController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch historical timeline records
router.get("/", historyController.getHistories);

// ADMINISTRATIVE
// Mutate historical timeline data
router.put(
  "/",
  verifyToken,
  checkPermission("manage_about"),
  historyController.updateHistories,
);

module.exports = router;
