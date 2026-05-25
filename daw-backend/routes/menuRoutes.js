const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch hierarchical navigation tree
router.get("/tree", menuController.getMenuTree);

// ADMINISTRATIVE

// Fetch flat menu registry for administrative management
router.get("/flat", verifyToken, menuController.getAllMenusFlat);

// Initialize new menu record
router.post(
  "/",
  verifyToken,
  checkPermission("manage_content"),
  menuController.createMenu,
);

// Mutate global navigation structure and sort order
router.put(
  "/reorder",
  verifyToken,
  checkPermission("manage_content"),
  menuController.reorderMenus,
);

// Mutate menu item configuration and link mapping
router.put(
  "/:id",
  verifyToken,
  checkPermission("manage_content"),
  menuController.updateMenu,
);

// Terminate menu record and associated sub-menus
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_content"),
  menuController.deleteMenu,
);

module.exports = router;
