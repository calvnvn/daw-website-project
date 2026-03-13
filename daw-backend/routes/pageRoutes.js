const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");

// Public
router.get("/slug/:slug", pageController.getPageBySlug);

// Admin (Nanti tambahkan middleware verifyToken di sini)
router.get("/", pageController.getAllPages);
router.post("/", pageController.createPage);
router.put("/:id", pageController.updatePage);
router.delete("/:id", pageController.deletePage);

module.exports = router;
