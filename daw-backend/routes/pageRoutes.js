const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken } = require("../middleware/authJwt");

// PUBLIC
// Fetch single page record by URL slug
router.get("/slug/:slug", pageController.getPageBySlug);

// ADMINISTRATIVE
// Fetch all page records for administrative management
router.get("/", verifyToken, pageController.getAllPages);

// Execute inline asset upload and optimization
router.post(
  "/upload-inline",
  verifyToken,
  upload.single("inline_image"),
  optimizeImage,
  pageController.uploadInlineImage,
);

// Initialize new page record with hero asset
router.post(
  "/",
  verifyToken,
  upload.single("heroImage"),
  optimizeImage,
  pageController.createPage,
);

// Mutate page record and associated hero asset
router.put(
  "/:id",
  verifyToken,
  upload.single("heroImage"),
  optimizeImage,
  pageController.updatePage,
);

// Terminate page record and purge associated assets
router.delete("/:id", verifyToken, pageController.deletePage);

module.exports = router;
