const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const multer = require("multer");
const { upload, optimizeImage } = require("../middleware/upload");

// Public Routes (Without Login)
router.get("/public", projectController.getPublicProjects);
router.get("/public/:id", projectController.getPublicProjectById);

// Protected Routes (Need Login)
router.use(verifyToken);

/** READ-ONLY: Semua user yang login biasanya boleh melihat daftar data. Jadi tidak butuh checkPermission khusus.
 */
router.get("/", projectController.getAllProjects);
router.get("/:id", projectController.getProjectById);

// Create Project
router.post(
  "/",
  checkPermission("manage_projects"),
  (req, res, next) => {
    upload.fields([
      { name: "cover_image", maxCount: 1 },
      { name: "gallery", maxCount: 10 },
    ])(req, res, (err) => {
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
  optimizeImage,
  projectController.createProject,
);

// Update Project
router.put(
  "/:id",
  checkPermission("manage_projects"),
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  optimizeImage,
  projectController.updateProject,
);

// Delete Project
router.delete(
  "/:id",
  checkPermission("manage_projects"),
  projectController.deleteProject,
);

// Upload Image dalam Editor
router.post(
  "/upload-inline",
  checkPermission("manage_projects"),
  upload.single("inline_image"),
  optimizeImage,
  projectController.uploadInlineImage,
);

module.exports = router;
