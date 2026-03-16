const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");

// Public
router.get("/tree", menuController.getMenuTree);

// Admin
router.get("/flat", menuController.getAllMenusFlat);
router.post("/", menuController.createMenu);
router.put("/reorder", menuController.reorderMenus);
router.put("/:id", menuController.updateMenu);
router.delete("/:id", menuController.deleteMenu);

module.exports = router;
