const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch hierarchical navigation tree
router.get("/tree", menuController.getMenuTree);

// ADMINISTRATIVE
router.use(verifyToken);

// Fetch flat menu registry for administrative management
router.get("/flat", menuController.getAllMenusFlat);

// Initialize new menu record
router.post("/", checkPermission("manage_content"), menuController.createMenu);

// Mutate global navigation structure and sort order
router.put(
  "/reorder",
  checkPermission("manage_content"),
  menuController.reorderMenus,
);

// Mutate menu item configuration and link mapping
router.put(
  "/:id",
  checkPermission("manage_content"),
  menuController.updateMenu,
);

// Terminate menu record and associated sub-menus
router.delete(
  "/:id",
  checkPermission("manage_content"),
  menuController.deleteMenu,
);

module.exports = router;
