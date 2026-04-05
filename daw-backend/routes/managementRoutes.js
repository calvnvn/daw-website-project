const express = require("express");
const router = express.Router();
const managementController = require("../controllers/managementController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

router.get("/", managementController.getAllManagements);

router.post(
  "/",
  [verifyToken, checkPermission("manage_about")],
  upload.single("photo"),
  optimizeImage,
  managementController.createManagement,
);
router.put(
  "/:id",
  [verifyToken, checkPermission("manage_about")],
  upload.single("photo"),
  optimizeImage,
  managementController.updateManagement,
);
router.delete(
  "/:id",
  [verifyToken, checkPermission("manage_about")],
  managementController.deleteManagement,
);

module.exports = router;
