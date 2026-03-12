const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Pastikan model User juga ter-import

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Raw Query
    const [users] = await sequelize.query(
      "SELECT * FROM Users WHERE email = :email LIMIT 1",
      {
        replacements: { email },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    if (!users) return res.status(404).json({ message: "User not found." });

    const passwordIsValid = bcrypt.compareSync(password, users.password);
    if (!passwordIsValid)
      return res.status(401).json({ message: "Invalid Password!" });

    const token = jwt.sign(
      { id: users.id, role: users.role },
      process.env.JWT_SECRET,
      {
        expiresIn: 86400, // 24 jam
      },
    );

    res.status(200).json({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      accessToken: token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
