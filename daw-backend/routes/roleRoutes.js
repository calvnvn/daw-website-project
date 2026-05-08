const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// ADMINISTRATIVE
router.use(verifyToken);
router.use(checkPermission("manage_users"));

// Fetch all role definitions
router.get("/", roleController.getAllRoles);

// Initialize new role record
router.post("/", roleController.createRole);

// Mutate role configuration and permissions
router.put("/:id", roleController.updateRole);

// Terminate role record and validate dependencies
router.delete("/:id", roleController.deleteRole);

module.exports = router;
