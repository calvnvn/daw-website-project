const express = require("express");
const router = express.Router();
const approvalController = require("../controllers/approvalController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// Hanya Admin (yang punya izin tertentu) yang bisa akses Approval Center
router.get(
  "/list",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.getPendingApprovals,
);
router.post(
  "/decide",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.executeDecision,
);

router.get(
  "/original-data",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.getOriginalData,
);

router.get(
  "/rejected/:id",
  verifyToken,
  approvalController.getRejectedDraftByTarget,
);

module.exports = router;
