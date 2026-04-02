const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

router.use(verifyToken);
router.use(checkPermission("manage_users"));

router.get("/", roleController.getAllRoles);
router.get("/permissions", roleController.getAllPermissions);
router.post("/", roleController.createRole);
router.put("/:id", roleController.updateRole);
router.delete("/:id", roleController.deleteRole);

module.exports = router;
