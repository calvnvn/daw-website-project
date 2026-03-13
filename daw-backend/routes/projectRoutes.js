const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const { verifyToken } = require("../middleware/authJwt");
const multer = require("multer");
const upload = require("../middleware/upload");
router.get("/public", projectController.getPublicProjects);
router.get("/public/:id", projectController.getPublicProjectById);
router.get("/", verifyToken, projectController.getAllProjects);
router.get("/:id", verifyToken, projectController.getProjectById);
router.delete("/:id", verifyToken, projectController.deleteProject);

router.post(
  "/",
  verifyToken,
  (req, res, next) => {
    upload.fields([
      { name: "cover_image", maxCount: 1 },
      { name: "gallery", maxCount: 10 },
    ])(req, res, (err) => {
      // 👇 Sekarang 'multer' di bawah ini sudah tidak error lagi
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ message: "File is too large! Max limit is 10MB." });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            message:
              "Too many files! You can only upload a maximum of 10 gallery images.",
          });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(500).json({ message: err.message });
      }
      next();
    });
  },
  projectController.createProject,
);

router.post(
  "/upload-inline",
  verifyToken,
  upload.single("inline_image"),
  projectController.uploadInlineImage,
);

router.put(
  "/:id",
  verifyToken,
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  projectController.updateProject,
);

module.exports = router;
