const express = require("express");
const router = express.Router();
const approvalController = require("../controllers/approvalController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// APPROVER ROUTES (Hanya untuk Superadmin & Approver)
// Mengambil antrean gabungan ERP + MySQL
router.get(
  "/list",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.getPendingApprovals,
);

// Eksekusi Keputusan (Approve/Reject) - The Decision Engine
router.post(
  "/decide",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.executeDecision,
);

router.post(
  "/force-purge",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.forcePurgeGhostTicket,
);

// Mengambil data asli untuk pembanding (Diff Viewer)
router.get(
  "/original-data",
  verifyToken,
  checkPermission("manage_approvals"),
  approvalController.getOriginalData,
);

// EDITOR ROUTES (Untuk Pembuat Draf/User Biasa)
// Menarik draf yang ditolak untuk proses REVISI
router.get(
  "/rejected/:id",
  verifyToken,
  approvalController.getRejectedDraftByTarget,
);

// Menghapus/Mengabaikan banner notifikasi merah di UI (Phase 4 UX)
router.patch("/discard/:notrans", verifyToken, approvalController.discardDraft);

module.exports = router;
