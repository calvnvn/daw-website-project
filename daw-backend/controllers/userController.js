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

// --- 1. CREATE USER (Tambahkan Guard Role) ---
exports.createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const requesterRole = req.userRole; // Dari middleware verifyToken

    // 🛡️ PROTEKSI: Hanya Superadmin yang boleh buat user baru
    if (requesterRole !== "Superadmin") {
      return res.status(403).json({
        message: "Access Denied: Only Superadmin can create new users.",
      });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `Daw${randomNum}!`;

    const newUser = await User.create({
      name,
      email,
      role: role || "Editor",
      password: tempPassword,
    });

    console.log(`[INFO] Temp Password for ${email} is: ${tempPassword}`);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      tempPassword: tempPassword,
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
};

// --- 2. UPDATE USER (Sudah Bagus, Tambahkan 1 Guard lagi) ---
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    const requesterRole = req.userRole;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🛡️ PROTEKSI 1: Editor dilarang keras ubah Role atau Status
    if (requesterRole === "Editor" && (role || status)) {
      return res.status(403).json({
        message: "Access Denied: Editors cannot change roles or status.",
      });
    }

    // 🛡️ PROTEKSI 2: Proteksi Sejenjang (Superadmin dilarang suspend sesama Superadmin)
    if (
      user.role === "Superadmin" &&
      status === "Suspended" &&
      requesterRole === "Superadmin"
    ) {
      return res.status(403).json({
        message:
          "Hierarchy Protection: You cannot suspend a fellow Superadmin.",
      });
    }

    // 🛡️ PROTEKSI 3: Jangan biarkan orang ganti role ke Superadmin sembarangan
    if (role === "Superadmin" && requesterRole !== "Superadmin") {
      return res
        .status(403)
        .json({ message: "You cannot promote users to Superadmin." });
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

// --- DELETE USER ---
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.userId; // ID Superadmin yang lagi login
    const requesterRole = req.userRole;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🛡️ GUARD 1: Anti-Self-Destruct (Cegah hapus akun sendiri)
    if (String(currentUserId) === String(id)) {
      return res.status(403).json({
        message: "Security Risk: You cannot delete your own account!",
      });
    }

    // 🛡️ GUARD 2: Proteksi Sejenjang (Superadmin dilarang hapus sesama Superadmin)
    if (user.role === "Superadmin") {
      return res.status(403).json({
        message:
          "Hierarchy Protection: Superadmin accounts are protected from deletion.",
      });
    }

    // 🛡️ GUARD 3: Editor dilarang hapus siapapun (Double Check)
    if (requesterRole !== "Superadmin") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only Superadmin can delete users." });
    }

    await user.destroy();

    res.json({
      success: true,
      message: `User ${user.name} has been deleted permanently.`,
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({ message: "Internal server error during deletion." });
  }
};
