exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Raw Query yang Benar
    // Hapus kurung siku [users], biarkan dia jadi Array murni
    const users = await sequelize.query(
      "SELECT * FROM Users WHERE email = :email LIMIT 1",
      {
        replacements: { email },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    // Ambil elemen pertama dari Array
    const user = users[0];

    // Validasi keberadaan user
    if (!user) return res.status(404).json({ message: "User not found." });

    // 2. Logic Guard: Cek Status Suspended
    if (user.status === "Suspended") {
      return res.status(403).json({
        message:
          "Access Denied. Your account has been suspended by Superadmin.",
      });
    }

    // 3. Verifikasi Password (Gunakan ASYNC agar server tidak freeze)
    const passwordIsValid = await bcrypt.compare(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ message: "Invalid Password!" });
    }

    // 4. Cek First Login (Untuk Force Change Password di Frontend)
    const isFirstLogin = user.lastLogin === null;

    // 5. Update lastLogin (Hanya jika BUKAN first login)
    if (!isFirstLogin) {
      await sequelize.query(
        "UPDATE Users SET lastLogin = NOW() WHERE id = :id",
        {
          replacements: { id: user.id },
          type: sequelize.QueryTypes.UPDATE,
        },
      );
    }

    // 6. Generate Token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: 86400, // 24 jam
      },
    );

    // 7. Kirim Response
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      accessToken: token,
      needsPasswordChange: isFirstLogin, // Kirim flag ini agar React tahu!
    });
  } catch (error) {
    console.error("[LOGIN ERROR]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
