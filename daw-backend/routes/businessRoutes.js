const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// 1. PUBLIC ENDPOINT
router.get("/public", businessController.getPublicBusinessData);

// 2. ADMIN ENDPOINTS (The Ledger & Vault)
router.get(
  "/admin",
  [verifyToken, checkPermission("manage_businesses")],
  businessController.getAdminBusinessSections,
);
router.post(
  "/admin",
  [verifyToken, checkPermission("manage_businesses")],
  businessController.createBusinessSection,
);
router.put(
  "/admin/:id",
  [verifyToken, checkPermission("manage_businesses")],
  businessController.updateBusinessSection,
);
router.delete(
  "/admin/:id",
  [verifyToken, checkPermission("manage_businesses")],
  businessController.deleteSection,
);

module.exports = router;
