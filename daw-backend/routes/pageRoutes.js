const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const checkLock = require("../middleware/checkLock");
const validate = require("../middleware/validate");
const { pageSchema } = require("../schemas/pageSchema");

// PUBLIC
// Fetch single page record by URL slug
router.get("/slug/:slug", pageController.getPageBySlug);

// ADMINISTRATIVE
// Fetch all page records for administrative management
router.get(
  "/",
  verifyToken,
  checkPermission("manage_content"),
  pageController.getAllPages,
);

// Execute inline asset upload and optimization
router.post(
  "/upload-inline",
  verifyToken,
  checkPermission("manage_content"),
  upload.single("inline_image"),
  optimizeImage,
  pageController.uploadInlineImage,
);

// Initialize new page record with hero asset
router.post(
  "/",
  verifyToken,
  checkPermission("manage_content"),
  upload.single("heroImage"),
  optimizeImage,
  validate(pageSchema),
  pageController.createPage,
);

// Mutate page record and associated hero asset
router.put(
  "/:id",
  verifyToken,
  checkPermission("manage_content"),
  upload.single("heroImage"),
  optimizeImage,
  validate(pageSchema.partial()),
  pageController.updatePage,
);

// Terminate page record and purge associated assets
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_content"),
  pageController.deletePage,
);

module.exports = router;
