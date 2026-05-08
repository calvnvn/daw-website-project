const express = require("express");
const router = express.Router();
const mapCategoryController = require("../controllers/mapCategoryController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC
// Fetch map marker category legend
router.get("/", mapCategoryController.getAllCategories);

// ADMINISTRATIVE
// Initialize map category master record
router.post(
  "/",
  [verifyToken, checkPermission("manage_businesses")],
  mapCategoryController.createCategory,
);

// Mutate map category configuration
router.put(
  "/:id",
  [verifyToken, checkPermission("manage_businesses")],
  mapCategoryController.updateCategory,
);

// Terminate map category record and validate marker dependencies
router.delete(
  "/:id",
  [verifyToken, checkPermission("manage_businesses")],
  mapCategoryController.deleteCategory,
);

module.exports = router;
