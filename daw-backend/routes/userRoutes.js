const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyToken, authorizeRoles } = require("../middleware/authJwt");

// Semua route di bawah ini butuh login
router.use(verifyToken);

// Editor boleh melihat daftar user (opsional, tergantung kebijakan kamu)
router.get("/", userController.getAllUsers);

// Hanya Superadmin yang boleh Create, Update, dan Delete
router.post("/", authorizeRoles("Superadmin"), userController.createUser);
router.put("/:id", authorizeRoles("Superadmin"), userController.updateUser);
router.delete("/:id", authorizeRoles("Superadmin"), userController.deleteUser);

module.exports = router;
