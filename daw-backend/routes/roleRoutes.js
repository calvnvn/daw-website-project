const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// ADMINISTRATIVE
// Fetch all role definitions
router.get(
  "/",
  verifyToken,
  checkPermission("manage_users"),
  roleController.getAllRoles,
);

// Initialize new role record
router.post(
  "/",
  verifyToken,
  checkPermission("manage_users"),
  roleController.createRole,
);

// Mutate role configuration and permissions
router.put(
  "/:id",
  verifyToken,
  checkPermission("manage_users"),
  roleController.updateRole,
);

// Terminate role record and validate dependencies
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_users"),
  roleController.deleteRole,
);

module.exports = router;
