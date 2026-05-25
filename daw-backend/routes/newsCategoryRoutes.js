const express = require("express");
const router = express.Router();
const newsCategoryController = require("../controllers/newsCategoryController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const validate = require("../middleware/validate");
const { newsCategorySchema } = require("../schemas/newsCategorySchema");

// Fetch all categories
router.get("/", newsCategoryController.getAllCategories);

// Create a new category
router.post(
  "/",
  verifyToken,
  checkPermission("manage_news"),
  validate(newsCategorySchema),
  newsCategoryController.createCategory,
);

// Update an existing category
router.put(
  "/:id",
  verifyToken,
  checkPermission("manage_news"),
  validate(newsCategorySchema),
  newsCategoryController.updateCategory,
);

// Delete a category
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_news"),
  newsCategoryController.deleteCategory,
);

module.exports = router;
