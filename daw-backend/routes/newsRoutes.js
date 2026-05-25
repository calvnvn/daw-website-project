const express = require("express");
const router = express.Router();
const newsController = require("../controllers/newsController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const multer = require("multer");
const { upload, optimizeImage } = require("../middleware/upload");
const checkLock = require("../middleware/checkLock");
const NewsArticle = require("../models/NewsArticle");
const validate = require("../middleware/validate");
const { newsSchema } = require("../schemas/newsSchema");

// PUBLIC
// Fetch published articles with pagination, search, and category filtering
router.get("/public", newsController.getPublicNews);

// Fetch public categories for filter dropdowns
router.get("/public/categories", newsController.getPublicCategories);

// Fetch article details by URL slug
router.get("/public/s/:slug", newsController.getPublicNewsBySlug);

// Increment views for a news article by slug
router.post("/public/s/:slug/view", newsController.incrementNewsViews);

// ADMINISTRATIVE
// Fetch comprehensive article registry for admin dashboard
router.get(
  "/",
  verifyToken,
  checkPermission("manage_news"),
  newsController.getAllNews,
);

// Fetch internal article record by ID
router.get(
  "/:id",
  verifyToken,
  checkPermission("manage_news"),
  newsController.getNewsById,
);

// Initialize new article with cover image handling and validation
router.post(
  "/",
  verifyToken,
  checkPermission("manage_news"),
  (req, res, next) => {
    upload.fields([{ name: "cover_image", maxCount: 1 }])(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ message: "File is too large! Max limit is 15MB." });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(500).json({ message: err.message });
      }
      next();
    });
  },
  optimizeImage,
  validate(newsSchema),
  newsController.createNews,
);

// Mutate article data and assets with pessimistic lock validation
router.put(
  "/:id",
  verifyToken,
  checkPermission("manage_news"),
  checkLock(NewsArticle),
  upload.fields([{ name: "cover_image", maxCount: 1 }]),
  optimizeImage,
  validate(newsSchema),
  newsController.updateNews,
);

// Terminate article record and associated assets with lock validation
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_news"),
  checkLock(NewsArticle),
  newsController.deleteNews,
);

// Execute WYSIWYG editor inline image upload pipeline
router.post(
  "/upload-inline",
  verifyToken,
  checkPermission("manage_news"),
  upload.single("inline_image"),
  optimizeImage,
  newsController.uploadInlineImage,
);

module.exports = router;
