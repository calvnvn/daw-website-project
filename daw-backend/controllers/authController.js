const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios"); // Tambahkan ini
const User = require("../models/User");

// 1. LOGIN (Hybrid: Local & OWL)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Cari User di DB Lokal (Bisa pakai email atau owl_username)
    const user = await User.findOne({
      where: {
        [sequelize.Sequelize.Op.or]: [{ email }, { owl_username: email }],
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User tidak terdaftar di CMS." });
    }

    if (user.status === "Suspended") {
      return res.status(403).json({ message: "Akun Anda ditangguhkan." });
    }

    let authSuccess = false;
    let owlData = null;

    // 2. STRATEGI AUTHENTICATION
    if (user.role === "Superadmin" && user.password) {
      // Jalur Backdoor untuk IT (Cek Local DB)
      authSuccess = await bcrypt.compare(password, user.password);
    } else {
      // Jalur Utama Karyawan (Tembak OWL)
      try {
        const owlResponse = await axios.post(
          "https://erp-aziz.daw.co.id/node/auth/login",
          {
            uname: user.owl_username, // Menggunakan username OWL yang terdaftar di DB
            password: password,
          },
        );

        if (owlResponse.data && owlResponse.data.status === "success") {
          authSuccess = true;
          owlData = owlResponse.data.user; // Ambil data user dari OWL jika ada
        }
      } catch (owlErr) {
        console.error(
          "❌ OWL Auth Failed:",
          owlErr.response?.data || owlErr.message,
        );
        return res
          .status(401)
          .json({ message: "Login OWL Gagal: Identitas tidak valid." });
      }
    }

    if (!authSuccess) {
      return res.status(401).json({ message: "Password salah!" });
    }

    // 3. AUTO-SYNC (Update Nama jika ada perubahan di OWL)
    if (owlData && owlData.nama) {
      await user.update({ name: owlData.nama, lastLogin: sequelize.fn("NOW") });
    } else {
      await user.update({ lastLogin: sequelize.fn("NOW") });
    }

    // 4. GENERATE JWT CMS
    // Karena kita pakai Fixed Roles, permission kita hardcode saja di token
    const permissions = getPermissionsByRole(user.role);

    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign(
      {
        id: user.id,
        owl_username: user.owl_username,
        role: user.role,
        permissions: permissions,
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    );

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: permissions,
      accessToken: token,
    });
  } catch (error) {
    console.error("[LOGIN ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 2. GET ME (Identitas Sesi)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const permissions = getPermissionsByRole(user.role);

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: permissions,
      status: user.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🛠️ HELPER: Mapping Permission Berdasarkan Role (Tanpa Tabel DB)
function getPermissionsByRole(role) {
  const common = ["dashboard", "manage_inbox"];
  const content = [
    "manage_businesses",
    "manage_projects",
    "manage_investments",
    "manage_content",
    "manage_homepage",
    "manage_about",
    "manage_settings",
  ];

  if (role === "Superadmin")
    return [...common, ...content, "manage_approvals", "manage_users"];
  if (role === "Editor") return [...common, ...content];
  if (role === "Approver") return ["dashboard", "manage_approvals"];
  return [];
}

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
