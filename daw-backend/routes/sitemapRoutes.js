const express = require("express");
const router = express.Router();
const sitemapController = require("../controllers/sitemapController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// PUBLIC SEO CRAWLER ROUTES
// Dynamic XML sitemap for SEO indexing (pages, projects, news)
router.get("/sitemap.xml", sitemapController.generateSitemap);

// Dynamic robots.txt serving crawler instructions and sitemap link
router.get("/robots.txt", sitemapController.generateRobotsTxt);

// CMS MANAGEMENT ENDPOINTS
router.get(
  "/api/seo/robots",
  [verifyToken, checkPermission("manage_settings")],
  sitemapController.getRobotsContent
);

router.put(
  "/api/seo/robots",
  [verifyToken, checkPermission("manage_settings")],
  sitemapController.updateRobotsContent
);

module.exports = router;
