const express = require("express");
const router = express.Router();
const businessController = require("../controllers/businessController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// Public Site
router.get("/public", businessController.getPublicBusinessData);

/**
 * @route   POST /api/businesses/admin
 * @desc    Mendaftarkan pintu untuk fungsi 'Create Section'
 */
router.post(
  "/admin",
  [verifyToken, checkPermission("manage_businesses")],
  businessController.createBusinessSection, // <-- Pastikan fungsi ini ada di controller
);

/**
 * @route   PUT /api/businesses/admin/:id
 * @desc    Mengupdate data seksi (Sudah ada di kode kamu)
 */
router.put(
  "/admin/:id",
  [verifyToken, checkPermission("manage_businesses")],
  businessController.updateBusinessSection,
);

/**
 * @route   DELETE /api/businesses/admin/:id
 * @desc    Mendaftarkan pintu untuk fungsi 'Delete Section'
 */
router.delete(
  "/admin/:id",
  [verifyToken, checkPermission("manage_businesses")],
  businessController.deleteSection, // <-- Pastikan fungsi ini ada di controller
);

module.exports = router;
