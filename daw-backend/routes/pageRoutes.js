const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");
const upload = require("../middleware/upload");

// Public
router.get("/slug/:slug", pageController.getPageBySlug);

// Admin (Nanti tambahkan middleware verifyToken di sini)
router.get("/", pageController.getAllPages);
router.post("/", upload.single("heroImage"), pageController.createPage);
router.put("/:id", upload.single("heroImage"), pageController.updatePage);
router.delete("/:id", pageController.deletePage);

module.exports = router;
