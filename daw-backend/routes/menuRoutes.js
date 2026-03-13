const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");

// Public
router.get("/tree", menuController.getMenuTree); // INI YANG DIPANGGIL NAVBAR FRONTEND

// Admin
router.get("/flat", menuController.getAllMenusFlat);
router.post("/", menuController.createMenu);
router.put("/reorder", menuController.reorderMenus); // Endpoint Drag & Drop
router.put("/:id", menuController.updateMenu);
router.delete("/:id", menuController.deleteMenu);

module.exports = router;
