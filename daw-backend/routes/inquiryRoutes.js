const express = require("express");
const router = express.Router();
const inquiryController = require("../controllers/inquiryController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const validate = require("../middleware/validate");
const { createInquirySchema } = require("../schemas/inquirySchema");
const { inquiryLimiter } = require("../middleware/rateLimiter");

// PUBLIC
// Fetch active inquiry categories for form selection
router.get("/subjects/active", inquiryController.getActiveSubjects);

// Initialize a new contact inquiry and dispatch notification
router.post("/", inquiryLimiter, validate(createInquirySchema), inquiryController.submitInquiry);

// ADMINISTRATIVE
// Retrieve all inquiry categories including inactive records
router.get(
  "/subjects",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.getAllSubjects,
);

// Initialize a new inquiry category
router.post(
  "/subjects",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.createSubject,
);

// Mutate inquiry category routing and configuration
router.put(
  "/subjects/:id",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.updateSubject,
);

// Terminate inquiry category and validate usage constraints
router.delete(
  "/subjects/:id",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.deleteSubject,
);

// Retrieve all incoming inquiry messages
router.get(
  "/",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.getAllInquiries,
);

// Bulk delete inquiry records
router.delete(
  "/bulk",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.bulkDeleteInquiries,
);

// Mutate inquiry read status
router.put(
  "/:id/read",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.markAsRead,
);

// Reassign inquiry to another subject
router.put(
  "/:id/reassign",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.reassignInquiry,
);

// Terminate inquiry record
router.delete(
  "/:id",
  verifyToken,
  checkPermission("manage_inbox"),
  inquiryController.deleteInquiry,
);

module.exports = router;
