const User = require("../models/User");
const Role = require("../models/Role");

// Retrieve sanitized user registry with associated role metadata
exports.getAllUsers = async (req, res) => {
  try {
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

// Whitelist external SSO identities for subsequent system synchronization
exports.createUser = async (req, res) => {
  try {
    const { email, roleId, owl_username } = req.body;

    // Validate administrative privilege level for identity registration
    if (req.userRole !== "superadmin") {
      return res.status(403).json({
        message:
          "Access Denied: Hanya superadmin yang berwenang mendaftarkan user baru.",
      });
    }

    // Verify presence of unique external handle for SSO mapping
    if (!owl_username) {
      return res
        .status(400)
        .json({ message: "OWL Username wajib diisi untuk sinkronisasi SSO." });
    }

    // Assert non-existence of identity in local registry to prevent collisions
    const existingUser = await User.findOne({ where: { owl_username } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: `Username OWL '${owl_username}' sudah terdaftar.` });
    }

    // Initialize unauthenticated placeholder record for external credential bridging
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

// Execute scoped profile mutations with privilege escalation guards
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, roleId, status } = req.body;
    const requesterId = req.userId;
    const requesterRole = req.userRole;

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "roleData" }],
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const targetRoleName = user.roleData?.name?.toLowerCase() || "";
    const targetIsSuperadmin = targetRoleName === "superadmin";

    // Enforce immutable state for Superadmin records against non-owner modifications
    const isEditingSelf = String(requesterId) === String(id);

    if (targetIsSuperadmin && !isEditingSelf) {
      if (roleId || status || email || name) {
        return res.status(403).json({
          message:
            "Hierarchy Protection: Akun superadmin tidak bisa diubah oleh administrator lain.",
        });
      }
    }

    // Restrict privilege escalation and status modification for Editor roles
    if (requesterRole === "editor" && (roleId || status)) {
      return res.status(403).json({
        message:
          "Forbidden: Editor tidak diizinkan mengubah Role atau Status akun.",
      });
    }

    // Map and synchronize only defined delta fields to the persistence layer
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

// Terminate user accounts while enforcing system stability and rank constraints
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.userId;
    const requesterRole = req.userRole;

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "roleData" }],
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Prevent session invalidation via recursive self-deletion logic
    if (String(currentUserId) === String(id)) {
      return res.status(403).json({
        message: "Security Risk: You cannot delete your own account!",
      });
    }

    // Block destruction of core system administrative accounts to maintain system integrity
    if (user.roleData?.name === "superadmin") {
      return res.status(403).json({
        message: "Hierarchy Protection: superadmin accounts are protected.",
      });
    }

    // Assert absolute administrative authority for account termination
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
