const express = require("express");
const router = express.Router();
const translationController = require("../controllers/translationController");
const { verifyToken } = require("../middleware/authJwt");

// All translation routes require authentication, but any CMS user can use them
router.use(verifyToken);

// GET /api/translation/manual?modelName=...&recordId=...
router.get("/manual", translationController.getManualTranslations);

// POST /api/translation/auto
router.post("/auto", translationController.autoTranslate);

module.exports = router;
