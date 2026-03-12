const express = require("express");
const router = express.Router();
const inquiryController = require("../controllers/inquiryController");
// const { verifyToken } = require("../middleware/authJwt");

router.post("/", inquiryController.submitInquiry);
router.get("/", inquiryController.getAllInquiries); // VT
router.put("/:id/read", inquiryController.markAsRead); // VT
router.delete("/:id", inquiryController.deleteInquiry); // VT

module.exports = router;
