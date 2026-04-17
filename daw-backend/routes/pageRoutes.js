const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");
const { upload, optimizeImage } = require("../middleware/upload");
const { verifyToken } = require("../middleware/authJwt");

// Public Access (Nggak butuh token)
router.get("/slug/:slug", pageController.getPageBySlug);

// Protected Access (WAJIB verifyToken sebelum controller)
router.get("/", verifyToken, pageController.getAllPages);

router.post(
  "/upload-inline",
  verifyToken,
  upload.single("inline_image"),
  optimizeImage,
  pageController.uploadInlineImage,
);

router.post(
  "/",
  verifyToken,
  upload.single("heroImage"),
  optimizeImage,
  pageController.createPage,
);

router.put(
  "/:id",
  verifyToken,
  upload.single("heroImage"),
  optimizeImage,
  pageController.updatePage,
);

router.delete("/:id", verifyToken, pageController.deletePage);

module.exports = router;
