const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");
const { upload, optimizeImage } = require("../middleware/upload");

/**
 * @route   GET /api/pages/slug/:slug
 * @desc    Fetch a single page by its unique slug (Public Access)
 */
router.get("/slug/:slug", pageController.getPageBySlug);

/**
 * @route   GET /api/pages
 * @desc    Get all pages with minimal attributes for admin list
 */
router.get("/", pageController.getAllPages);

/**
 * @route   POST /api/pages/upload-inline
 * @desc    Upload an image from the Rich Text Editor (Quill)
 * @note    Uses 'inline_image' fieldname as defined in the upload middleware
 */
router.post(
  "/upload-inline",
  upload.single("inline_image"),
  optimizeImage,
  pageController.uploadInlineImage,
);

/**
 * @route   POST /api/pages
 * @desc    Create a new dynamic page with hero image optimization
 */
router.post(
  "/",
  upload.single("heroImage"),
  optimizeImage,
  pageController.createPage,
);

/**
 * @route   PUT /api/pages/:id
 * @desc    Update existing page data and replace hero image if provided
 */
router.put(
  "/:id",
  upload.single("heroImage"),
  optimizeImage,
  pageController.updatePage,
);

/**
 * @route   DELETE /api/pages/:id
 * @desc    Remove page record and trigger physical file cleanup
 */
router.delete("/:id", pageController.deletePage);

module.exports = router;
