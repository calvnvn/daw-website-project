const express = require("express");
const router = express.Router();
const historyController = require("../controllers/historyController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// 1. Public SIte
router.get("/", historyController.getHistories);

// 2. Protected Site
router.put(
  "/",
  [verifyToken, checkPermission("manage_about")],
  historyController.updateHistories,
);

module.exports = router;
