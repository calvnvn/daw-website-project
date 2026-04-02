const User = require("../models/User");
const Role = require("../models/Role");

exports.getAllUsers = async (req, res) => {
  try {
    // Fetch all users w/o send it to frontend
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Role,
          as: "roleData",
          attributes: ["name"],
        },
      ],
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
    const { name, email, roleId } = req.body;
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

    await User.create({
      name,
      email,
      roleId,
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
    const { name, email, roleId, status } = req.body;
    const requesterRole = req.userRole; // Role si pengeklik (dari JWT)
    const requesterId = req.userId; // ID si pengeklik

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "roleData" }],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // 🛡️ 1. ULTIMATE HIERARCHY GUARD
    // Siapapun (termasuk Superadmin lain) dilarang mengubah Role/Status seorang Superadmin,
    // KECUALI Superadmin itu sendiri yang mengubah datanya (misal: ganti nama/email).
    const targetIsSuperadmin = user.roleData?.name === "Superadmin";
    const isEditingSelf = String(requesterId) === String(id);

    if (targetIsSuperadmin && !isEditingSelf) {
      if (roleId || status) {
        return res.status(403).json({
          message:
            "Hierarchy Protection: Superadmin access levels are immutable by other users.",
        });
      }
    }

    // 🛡️ 2. EDITOR ACCESS RESTRICTION
    if (requesterRole === "Editor" && (roleId || status)) {
      return res.status(403).json({
        message:
          "Forbidden: Editors are not authorized to elevate roles or change account status.",
      });
    }

    // 🛡️ 3. PARTIAL UPDATE PATTERN (Surgical Precision)
    // Kita hanya memasukkan data ke objek update jika nilainya benar-benar dikirim.
    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (roleId !== undefined) updatePayload.roleId = roleId;
    if (status !== undefined) updatePayload.status = status;

    // Pastikan tidak ada payload kosong yang dikirim ke .update()
    if (Object.keys(updatePayload).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update." });
    }

    await user.update(updatePayload);

    res.json({
      success: true,
      message: `User ${user.name} updated successfully.`,
    });
  } catch (error) {
    console.error("[UPDATE USER ERROR]:", error);
    res.status(500).json({ message: "Internal server error during update." });
  }
};

// --- DELETE USER ---
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.userId;
    const requesterRole = req.userRole;

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "roleData" }],
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🛡️ GUARD 1: Anti-Self-Destruct (Cegah hapus akun sendiri)
    if (String(currentUserId) === String(id)) {
      return res.status(403).json({
        message: "Security Risk: You cannot delete your own account!",
      });
    }

    // 🛡️ GUARD 2: Proteksi Sejenjang (Superadmin dilarang hapus sesama Superadmin)
    if (user.roleData?.name === "Superadmin") {
      return res.status(403).json({
        message: "Hierarchy Protection: Superadmin accounts are protected.",
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
