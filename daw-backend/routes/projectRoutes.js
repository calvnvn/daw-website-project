const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const multer = require("multer");
const { upload, optimizeImage } = require("../middleware/upload");
const checkLock = require("../middleware/checkLock");
const Project = require("../models/Project");

// PUBLIC
// Fetch project portfolio for public display
router.get("/public", projectController.getPublicProjects);

// Fetch project details by ID
router.get("/public/:id", projectController.getPublicProjectById);

// Fetch project details by URL slug
router.get("/public/s/:slug", projectController.getPublicProjectBySlug);

// ADMINISTRATIVE
router.use(verifyToken);

// Fetch comprehensive project registry
router.get("/", projectController.getAllProjects);

// Fetch internal project record by ID
router.get("/:id", projectController.getProjectById);

/// Initialize new project with multi-asset handling and validation/ Create Project
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
          return res
            .status(400)
            .json({ message: "Too many files! Max 10 gallery images." });
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

// Mutate project data and assets with pessimistic lock validation
router.put(
  "/:id",
  checkPermission("manage_projects"),
  checkLock(Project),
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  optimizeImage,
  projectController.updateProject,
);

// Terminate project record and associated assets with lock validation
router.delete(
  "/:id",
  checkPermission("manage_projects"),
  checkLock(Project),
  projectController.deleteProject,
);

// Execute editor asset upload and optimization pipeline
router.post(
  "/upload-inline",
  checkPermission("manage_projects"),
  upload.single("inline_image"),
  optimizeImage,
  projectController.uploadInlineImage,
);

module.exports = router;
