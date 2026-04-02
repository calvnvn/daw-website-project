const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// Public
router.get("/tree", menuController.getMenuTree); // Public

// Admin Area
router.use(verifyToken);
router.get("/flat", menuController.getAllMenusFlat);
router.post("/", checkPermission("manage_content"), menuController.createMenu);
router.put(
  "/reorder",
  checkPermission("manage_content"),
  menuController.reorderMenus,
);
router.put(
  "/:id",
  checkPermission("manage_content"),
  menuController.updateMenu,
);
router.delete(
  "/:id",
  checkPermission("manage_content"),
  menuController.deleteMenu,
);

module.exports = router;
