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

// --- 1. CREATE USER (Sync with Lowercase Middleware) ---
exports.createUser = async (req, res) => {
  try {
    const { email, roleId, owl_username } = req.body;

    // 🚀 FIX: Gunakan lowercase 'superadmin' sesuai output middleware
    if (req.userRole !== "superadmin") {
      return res.status(403).json({
        message:
          "Access Denied: Hanya superadmin yang berwenang mendaftarkan user baru.",
      });
    }

    if (!owl_username) {
      return res
        .status(400)
        .json({ message: "OWL Username wajib diisi untuk sinkronisasi SSO." });
    }

    const existingUser = await User.findOne({ where: { owl_username } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: `Username OWL '${owl_username}' sudah terdaftar.` });
    }

    await User.create({
      name: "Menunggu Sync Login...",
      email: email && email.trim() !== "" ? email : null,
      owl_username: owl_username.trim(),
      roleId: roleId,
      password: "SSO_USER_NO_LOCAL_LOGIN",
      status: "Active",
    });

    res.status(201).json({
      success: true,
      message: `User '${owl_username}' berhasil di-whitelist.`,
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
};

// --- 2. UPDATE USER (Hierarchy & Case Guard) ---
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, roleId, status } = req.body;
    const requesterId = req.userId;
    const requesterRole = req.userRole; // Pasti lowercase dari middleware

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "roleData" }],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const targetRoleName = user.roleData?.name?.toLowerCase() || "";
    const targetIsSuperadmin = targetRoleName === "superadmin";
    const isEditingSelf = String(requesterId) === String(id);

    if (targetIsSuperadmin && !isEditingSelf) {
      if (roleId || status || email || name) {
        return res.status(403).json({
          message:
            "Hierarchy Protection: Akun superadmin tidak bisa diubah oleh administrator lain.",
        });
      }
    }

    // 🛡️ 2. EDITOR ACCESS RESTRICTION (Fix Case)
    if (requesterRole === "editor" && (roleId || status)) {
      return res.status(403).json({
        message:
          "Forbidden: Editor tidak diizinkan mengubah Role atau Status akun.",
      });
    }

    // 🛡️ 3. PARTIAL UPDATE PATTERN
    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (roleId !== undefined) updatePayload.roleId = roleId;
    if (status !== undefined) updatePayload.status = status;

    if (Object.keys(updatePayload).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update." });
    }

    await user.update(updatePayload);

    res.json({
      success: true,
      message: `User ${user.name} berhasil diperbarui.`,
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

    // 🛡️ GUARD 2: Proteksi Sejenjang (superadmin dilarang hapus sesama superadmin)
    if (user.roleData?.name === "superadmin") {
      return res.status(403).json({
        message: "Hierarchy Protection: superadmin accounts are protected.",
      });
    }

    // 🛡️ GUARD 3: Editor dilarang hapus siapapun (Double Check)
    if (requesterRole !== "superadmin") {
      return res
        .status(403)
        .json({ message: "Forbidden: Only superadmin can delete users." });
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
