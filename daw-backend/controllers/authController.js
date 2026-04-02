const sequelize = require("../config/database");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const transporter = require("../utils/mailer");
const Role = require("../models/Role");
const Permission = require("../models/Permission");

// 1. LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: Role,
          as: "roleData", // Sesuaikan dengan alias di server.js
          include: [
            {
              model: Permission,
              as: "permissions",
              attributes: ["name"],
              through: { attributes: [] }, // Sembunyikan tabel junction
            },
          ],
        },
      ],
    });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.status === "Suspended") {
      return res.status(403).json({
        message:
          "Access Denied. Your account has been suspended by Superadmin.",
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ message: "Invalid Password!" });
    }

    const isFirstLogin = user.lastLogin === null;
    if (!isFirstLogin) {
      // Update lastLogin tanpa memicu hook beforeUpdate
      await User.update(
        { lastLogin: sequelize.fn("NOW") },
        { where: { id: user.id } },
      );
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("[FATAL] JWT_SECRET is missing in .env file!");
      process.exit(1);
    }

    // Ambil daftar nama permission ke dalam array string sederhana
    const userPermissions =
      user.roleData?.permissions?.map((p) => p.name) || [];

    const token = jwt.sign(
      {
        id: user.id,
        role: user.roleData?.name || "No Role",
        permissions: userPermissions,
      },
      jwtSecret,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
      },
    );

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.roleData?.name, // Kirim nama role asli ke frontend
      permissions: userPermissions, // Kirim array permission agar frontend bisa sembunyikan menu
      accessToken: token,
      needsPasswordChange: isFirstLogin,
    });
  } catch (error) {
    console.error("[LOGIN ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 2. GET ME (Cek Sesi Saat Ini)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ["id", "name", "email", "status"],
      include: [
        {
          model: Role,
          as: "roleData",
          include: [
            {
              model: Permission,
              as: "permissions",
              attributes: ["name"],
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.status === "Suspended") {
      return res
        .status(403)
        .json({ message: "Your account has been suspended." });
    }

    // Ekstraksi permission agar formatnya sama dengan login
    const userPermissions =
      user.roleData?.permissions?.map((p) => p.name) || [];

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.roleData?.name,
      permissions: userPermissions,
      status: user.status,
    });
  } catch (error) {
    console.error("[GET ME ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 3. FORCE CHANGE PASSWORD (Saat Pertama Login)
exports.forceChangePassword = async (req, res) => {
  try {
    const userId = req.userId || req.id || (req.user && req.user.id);
    const { newPassword } = req.body;

    if (!userId) return res.status(401).json({ message: "Unauthorized." });
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    //  FIX: Mengandalkan Hook di Model agar tidak Double Hashing
    user.password = newPassword;

    // Simpan data & picu Hook
    await user.save();

    // Update timestamp secara terpisah agar rapi
    await User.update(
      { lastLogin: sequelize.fn("NOW") },
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

// 4. REQUEST FORGOT PASSWORD (Kirim Email)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res
        .status(404)
        .json({ message: "Email not registered in the system." });
    }

    // Generate Token Acak
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 3600000); // 1 Jam

    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpires: tokenExpiry,
    });

    //  SMART EXTRACTION: Ambil URL dari ALLOWED_ORIGINS jika FRONTEND_URL tidak ada
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:5173"];
    const frontendUrl = process.env.FRONTEND_URL || allowedOrigins[0];
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    //   Eksekusi Pengiriman Email
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "DAW CMS - Password Reset Request",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #0f172a;">Password Reset Request</h2>
          <p style="color: #475569; line-height: 1.6;">Hello ${user.name},</p>
          <p style="color: #475569; line-height: 1.6;">We received a request to reset the password for your DAW Group Admin account. Click the button below to set a new password. This link is valid for exactly <strong>1 hour</strong>.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #004B23; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset My Password</a>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
            If you did not request this, please ignore this email or contact the Superadmin immediately.
          </p>
        </div>
      `,
    });

    res
      .status(200)
      .json({ message: "Password reset link has been sent to your email." });
  } catch (error) {
    console.error("[FORGOT PASSWORD ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 5. EXECUTE RESET PASSWORD (Simpan Password Baru)
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token is invalid or has expired." });
    }

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    // Update & Clean up (Akan memicu Hook hashing di User.js)
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res
      .status(200)
      .json({ message: "Password successfully reset. You can now login." });
  } catch (error) {
    console.error("[RESET PASSWORD ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
