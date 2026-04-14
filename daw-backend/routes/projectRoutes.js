const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const multer = require("multer");
const { upload, optimizeImage } = require("../middleware/upload");

// --- IMPORT BARU ---
const checkLock = require("../middleware/checkLock");
const Project = require("../models/Project");
// -------------------

// Public Routes (Without Login)
router.get("/public", projectController.getPublicProjects);
router.get("/public/:id", projectController.getPublicProjectById);
router.get("/public/s/:slug", projectController.getPublicProjectBySlug);

// Protected Routes (Need Login)
router.use(verifyToken);

/** READ-ONLY: Semua user yang login biasanya boleh melihat daftar data. */
router.get("/", projectController.getAllProjects);
router.get("/:id", projectController.getProjectById);

// Create Project (Tidak butuh checkLock karena data baru belum ada gemboknya)
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

// Update Project (DILINDUNGI checkLock)
router.put(
  "/:id",
  checkPermission("manage_projects"),
  checkLock(Project), // 🔒 Cek gembok SEBELUM proses upload file
  upload.fields([
    { name: "cover_image", maxCount: 1 },
    { name: "gallery", maxCount: 10 },
  ]),
  optimizeImage,
  projectController.updateProject,
);

// Delete Project (DILINDUNGI checkLock)
router.delete(
  "/:id",
  checkPermission("manage_projects"),
  checkLock(Project), // 🔒 Cek gembok sebelum hapus
  projectController.deleteProject,
);

// Upload Image dalam Editor
router.post(
  "/upload-inline",
  checkPermission("manage_projects"),
  // Note: Untuk inline image biasanya tidak perlu checkLock per ID
  // karena ini hanya upload asset baru ke server
  upload.single("inline_image"),
  optimizeImage,
  projectController.uploadInlineImage,
);

module.exports = router;
