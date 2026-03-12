const express = require("express");
const router = express.Router();
const managementController = require("../controllers/managementController");
const upload = require("../middleware/upload");

// Pastikan import ini sesuai dengan nama file aslimu (authJwt atau authMiddleware)
const { verifyToken } = require("../middleware/authJwt");

router.get("/", managementController.getAllManagements);

router.post(
  "/",
  verifyToken,
  upload.single("photo"),
  managementController.createManagement,
);
router.put(
  "/:id",
  verifyToken,
  upload.single("photo"),
  managementController.updateManagement,
);
router.delete("/:id", verifyToken, managementController.deleteManagement);

module.exports = router;
