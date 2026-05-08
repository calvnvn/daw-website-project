const express = require("express");
const router = express.Router();
const sitemapController = require("../controllers/sitemapController");

// PUBLIC
// Generate dynamic XML sitemap for SEO indexing
router.get("/sitemap.xml", sitemapController.generateSitemap);

module.exports = router;
