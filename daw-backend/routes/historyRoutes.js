const express = require("express");
const router = express.Router();
const historyController = require("../controllers/historyController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const checkLock = require("../middleware/checkLock");
const History = require("../models/History");

// PUBLIC
// Fetch historical timeline records
router.get("/", historyController.getHistories);

// ADMINISTRATIVE
// Mutate historical timeline data
router.put(
  "/",
  verifyToken,
  checkPermission("manage_about"),
  checkLock(History),
  historyController.updateHistories,
);

module.exports = router;
