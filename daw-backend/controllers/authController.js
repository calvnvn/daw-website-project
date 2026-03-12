const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User"); // Pastikan model User juga ter-import

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Raw Query
    const users = await sequelize.query(
      "SELECT * FROM Users WHERE email = :email LIMIT 1",
      {
        replacements: { email },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    // 2. Ambil user tunggal (Penting!)
    const user = users[0];

    // FIX LOGIC: Cek jika array kosong atau user tidak ada
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.status === "Suspended") {
      return res.status(403).json({
        message:
          "Access Denied. Your account has been suspended by Superadmin.",
      });
    }

    // 3. Verifikasi Password (Gunakan user.password)
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid)
      return res.status(401).json({ message: "Invalid Password!" });

    const isFirstLogin = user.lastLogin === null;

    if (!isFirstLogin) {
      await sequelize.query(
        "UPDATE Users SET lastLogin = NOW() WHERE id = :id",
        {
          replacements: { id: user.id },
          type: sequelize.QueryTypes.UPDATE,
        },
      );
    }

    // 4. GENERATE TOKEN (PASTIKAN PAKAI 'user.id' BUKAN 'users.id')
    const token = jwt.sign(
      { id: user.id, role: user.role }, // <-- FIX DI SINI
      process.env.JWT_SECRET || "rahasia_daw_2026",
      { expiresIn: 86400 },
    );

    // 5. RESPONSE
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
    // 👇 Pakai findByPk, jauh lebih aman dan bersih daripada Raw SQL
    const user = await User.findByPk(req.userId, {
      attributes: ["id", "name", "email", "role", "status"], // Saring kolom yang mau dikirim
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
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.forceChangePassword = async (req, res) => {
  try {
    const userId = req.userId || req.id || (req.user && req.user.id);
    const { newPassword } = req.body;

    // 1. Validasi Input (Pastikan password tidak kosong & cukup kuat)
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized: User ID not found in token.",
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    // 2. HASHING MANUAL (Krusial karena Raw Query mem-bypass Hooks Model)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. RAW QUERY: Update password DAN catat waktu lastLogin
    await sequelize.query(
      `UPDATE Users 
       SET password = :password, lastLogin = NOW() 
       WHERE id = :id`,
      {
        replacements: {
          password: hashedPassword,
          id: userId,
        },
        type: sequelize.QueryTypes.UPDATE,
      },
    );

    res.status(200).json({
      success: true,
      message:
        "Password berhasil diperbarui! Silakan nikmati akses ke Dashboard.",
    });
  } catch (error) {
    console.error("[FORCE CHANGE PASSWORD ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
