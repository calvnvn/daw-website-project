const express = require("express");
const router = express.Router();
const newsCategoryController = require("../controllers/newsCategoryController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// All category management requires authentication
router.use(verifyToken);

// Fetch all categories
router.get("/", newsCategoryController.getAllCategories);

// Create a new category
router.post(
  "/",
  checkPermission("manage_news"),
  newsCategoryController.createCategory,
);

// Update an existing category
router.put(
  "/:id",
  checkPermission("manage_news"),
  newsCategoryController.updateCategory,
);

// Delete a category
router.delete(
  "/:id",
  checkPermission("manage_news"),
  newsCategoryController.deleteCategory,
);

module.exports = router;
