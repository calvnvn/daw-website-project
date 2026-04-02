const express = require("express");
const router = express.Router();
const inquiryController = require("../controllers/inquiryController");
const { verifyToken, checkPermission } = require("../middleware/authJwt"); // Pastikan middleware auth sudah di-import

// --- ROUTES UNTUK MASTER SUBJECT ---
// Public
router.get("/subjects/active", inquiryController.getActiveSubjects);
router.post("/", inquiryController.submitInquiry);

// Admin Only
router.get(
  "/subjects",
  [verifyToken, checkPermission("manage_inbox")],
  inquiryController.getAllSubjects,
);
router.post(
  "/subjects",
  [verifyToken, checkPermission("manage_inbox")],
  inquiryController.createSubject,
);
router.put(
  "/subjects/:id",
  [verifyToken, checkPermission("manage_inbox")],
  inquiryController.updateSubject,
);
router.delete(
  "/subjects/:id",
  [verifyToken, checkPermission("manage_inbox")],
  inquiryController.deleteSubject,
);

// Inbox
router.get(
  "/",
  [verifyToken, checkPermission("manage_inbox")],
  inquiryController.getAllInquiries,
);
router.put(
  "/:id/read",
  [verifyToken, checkPermission("manage_inbox")],
  inquiryController.markAsRead,
);
router.delete(
  "/:id",
  [verifyToken, checkPermission("manage_inbox")],
  inquiryController.deleteInquiry,
);

module.exports = router;
