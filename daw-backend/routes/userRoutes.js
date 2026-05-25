const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { verifyToken, checkPermission } = require("../middleware/authJwt");
const validate = require("../middleware/validate");
const { createUserSchema, updateUserSchema } = require("../schemas/userSchema");

// ADMINISTRATIVE
router.use(verifyToken);

// Fetch comprehensive user registry excluding sensitive credentials
router.get("/", checkPermission("manage_users"), userController.getAllUsers);

// Initialize new user identity for SSO whitelisting
router.post("/", checkPermission("manage_users"), validate(createUserSchema), userController.createUser);

// Mutate user profile data and account status
router.put("/:id", checkPermission("manage_users"), validate(updateUserSchema), userController.updateUser);

// Terminate user record and enforce hierarchy constraints
router.delete(
  "/:id",
  checkPermission("manage_users"),
  userController.deleteUser,
);

module.exports = router;
