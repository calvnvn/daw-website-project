const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User"); // Pastikan model User juga ter-import

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Fetch User securely via ORM
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 2. Account Status Validation
    if (user.status === "Suspended") {
      return res.status(403).json({
        message:
          "Access Denied. Your account has been suspended by Superadmin.",
      });
    }

    // 3. Non-blocking Password Verification
    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ message: "Invalid Password!" });
    }

    // 4. Update Login Timestamp (Only if not first login)
    const isFirstLogin = user.lastLogin === null;
    if (!isFirstLogin) {
      await User.update(
        { lastLogin: sequelize.fn("NOW") },
        { where: { id: user.id } },
      );
    }

    // 5. JWT Generation (Fail-Fast Mechanism)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("[FATAL] JWT_SECRET is missing in .env file!");
      process.exit(1);
    }

    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    });

    // 6. Response
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accessToken: token,
      needsPasswordChange: isFirstLogin,
    });
  } catch (error) {
    console.error("[LOGIN ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ["id", "name", "email", "role", "status"], // Exclude sensitive data
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.status === "Suspended") {
      return res
        .status(403)
        .json({ message: "Your account has been suspended." });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("[GET ME ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.forceChangePassword = async (req, res) => {
  try {
    const userId = req.userId || req.id || (req.user && req.user.id);
    const { newPassword } = req.body;

    // 1. Input Validation
    if (!userId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User ID not found in token." });
    }

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    // 2. Manual Hashing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. Update User via ORM
    await User.update(
      {
        password: hashedPassword,
        lastLogin: sequelize.fn("NOW"),
      },
      { where: { id: userId } },
    );

    res.status(200).json({
      success: true,
      message: "Password updated successfully. Welcome to the Dashboard.",
    });
  } catch (error) {
    console.error("[FORCE CHANGE PASSWORD ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
