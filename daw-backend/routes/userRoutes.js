const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");

// Semua route di bawah ini butuh login
router.use(verifyToken);

// Editor boleh melihat daftar user (opsional, tergantung kebijakan kamu)
router.get("/", userController.getAllUsers);

// Hanya superadmin yang boleh Create, Update, dan Delete
router.post("/", checkPermission("manage_users"), userController.createUser);
router.put("/:id", checkPermission("manage_users"), userController.updateUser);
router.delete(
  "/:id",
  checkPermission("manage_users"),
  userController.deleteUser,
);

module.exports = router;
