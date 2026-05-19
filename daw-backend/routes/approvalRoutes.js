const express = require("express");
const router = express.Router();
const approvalController = require("../controllers/approvalController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// APPROVER
// Fetch consolidated transaction queue
router.get(
  "/list",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.getPendingApprovals,
);

// Execute approval or rejection logic
router.post(
  "/decide",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.executeDecision,
);

// Purge orphaned transaction tickets
router.post(
  "/force-purge",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.forcePurgeGhostTicket,
);

// Retrieve baseline data for state comparison
router.get(
  "/original-data",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.getOriginalData,
);

// EDITOR
// Fetch rejected draft metadata
router.get(
  "/rejected/:id",
  verifyToken,
  approvalController.getRejectedDraftByTarget,
);

// Dismiss rejection status and notifications
router.patch("/discard", verifyToken, approvalController.discardDraft);

module.exports = router;
