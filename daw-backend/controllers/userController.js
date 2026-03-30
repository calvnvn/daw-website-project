const User = require("../models/User");

exports.getAllUsers = async (req, res) => {
  try {
    // Fetch all users w/o send it to frontend
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `Daw${randomNum}!`;

    const newUser = await User.create({
      name,
      email,
      role,
      password: tempPassword,
    });

    // Bisa panggil Nodemailer Function disini untuk mengirim 'tempPassword' ke email user
    console.log(`[INFO] Temp Password for ${email} is: ${tempPassword}`);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      // Jangan pernah kembalikan password asli di response production,
      // tapi untuk development kita kirim agar kamu bisa login nanti.
      tempPassword: tempPassword,
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
};

// Update User
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    const requesterRole = req.userRole; // Dari middleware verifyToken

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🛡️ PROTEKSI 1: Hanya Superadmin yang bisa ganti Role atau Status
    if (requesterRole !== "Superadmin" && (role || status)) {
      return res
        .status(403)
        .json({ message: "Editors cannot change roles or account status." });
    }

    // 🛡️ PROTEKSI 2: Proteksi Sejenjang (Superadmin dilarang suspend Superadmin lain)
    if (user.role === "Superadmin" && status === "Suspended") {
      return res.status(403).json({
        message:
          "Hierarchy Protection: A Superadmin cannot suspend another Superadmin account.",
      });
    }

    await user.update({ name, email, role, status });
    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

// DELETE User
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    const requesterRole = req.userRole; // Dari middleware verifyToken

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🛡️ PROTEKSI 1: Hanya Superadmin yang bisa ganti Role atau Status
    if (requesterRole !== "Superadmin" && (role || status)) {
      return res
        .status(403)
        .json({ message: "Editors cannot change roles or account status." });
    }

    // 🛡️ PROTEKSI 2: Proteksi Sejenjang (Superadmin dilarang suspend Superadmin lain)
    if (user.role === "Superadmin" && status === "Suspended") {
      return res.status(403).json({
        message:
          "Hierarchy Protection: A Superadmin cannot suspend another Superadmin account.",
      });
    }

    await user.update({ name, email, role, status });
    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user.id,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};
