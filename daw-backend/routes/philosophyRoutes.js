const express = require("express");
const router = express.Router();
const philosophyController = require("../controllers/philosophyController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

router.get("/", philosophyController.getPhilosophy);
router.put(
  "/",
  [verifyToken, checkPermission("manage_about")],
  philosophyController.updatePhilosophy,
);

module.exports = router;
