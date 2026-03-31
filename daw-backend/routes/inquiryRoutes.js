const express = require("express");
const router = express.Router();
const inquiryController = require("../controllers/inquiryController");
const { verifyToken } = require("../middleware/authJwt"); // Pastikan middleware auth sudah di-import

// --- ROUTES UNTUK MASTER SUBJECT ---
// Public: Form Contact Us butuh ini
router.get("/subjects/active", inquiryController.getActiveSubjects);

// Admin Only
router.get("/subjects", verifyToken, inquiryController.getAllSubjects);
router.post("/subjects", verifyToken, inquiryController.createSubject);
router.put("/subjects/:id", verifyToken, inquiryController.updateSubject);
router.delete("/subjects/:id", verifyToken, inquiryController.deleteSubject);

// Inbox
router.post("/", inquiryController.submitInquiry);
router.get("/", verifyToken, inquiryController.getAllInquiries);
router.put("/:id/read", verifyToken, inquiryController.markAsRead);
router.delete("/:id", verifyToken, inquiryController.deleteInquiry);

module.exports = router;
