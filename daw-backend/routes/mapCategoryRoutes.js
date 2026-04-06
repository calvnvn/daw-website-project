const express = require("express");
const router = express.Router();
const mapCategoryController = require("../controllers/mapCategoryController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// Public (Buat Legend di Peta)
router.get("/", mapCategoryController.getAllCategories);

// Admin (CRUD Master Data)
router.post(
  "/",
  [verifyToken, checkPermission("manage_businesses")],
  mapCategoryController.createCategory,
);
router.put(
  "/:id",
  [verifyToken, checkPermission("manage_businesses")],
  mapCategoryController.updateCategory,
);
router.delete(
  "/:id",
  [verifyToken, checkPermission("manage_businesses")],
  mapCategoryController.deleteCategory,
);

module.exports = router;
