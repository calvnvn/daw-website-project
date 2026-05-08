const Role = require("../models/Role");
const User = require("../models/User");

// Retrieve all available roles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      attributes: ["id", "name", "description"],
      order: [["name", "ASC"]],
    });

    res.status(200).json(roles);
  } catch (error) {
    console.error("🚨 [GET ROLES ERROR]:", error.message);
    res.status(500).json({
      message: "Failed to fetch roles",
      error: error.message,
    });
  }
};

// Create a new role definition
exports.createRole = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name)
      return res.status(400).json({ message: "Nama role wajib diisi." });

    const role = await Role.create({ name, description });

    res.status(201).json({
      success: true,
      message: "Role baru berhasil dibuat.",
      data: role,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal membuat role.", error: error.message });
  }
};

// Update role details with system hierarchy protection
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const role = await Role.findByPk(id);
    if (!role)
      return res.status(404).json({ message: "Role tidak ditemukan." });

    // Guard: Prevent renaming the core 'superadmin' identity
    if (role.name === "superadmin" && name !== "superadmin") {
      return res
        .status(403)
        .json({ message: "Dilarang mengubah nama role sistem (superadmin)." });
    }

    await role.update({ name, description });

    res
      .status(200)
      .json({ success: true, message: "Role berhasil diperbarui." });
  } catch (error) {
    res.status(500).json({ message: "Update gagal.", error: error.message });
  }
};

// Delete role with strict system and referential integrity guards
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findByPk(id);

    if (!role)
      return res.status(404).json({ message: "Role tidak ditemukan." });

    // Guard 1: Protect core system roles from deletion
    if (["superadmin", "Editor", "Approver"].includes(role.name)) {
      return res.status(403).json({
        message: `Role sistem '${role.name}' dilindungi dan tidak dapat dihapus.`,
      });
    }

   // Guard 2: Prevent deletion if users are currently assigned to this role (Referential Integrity)
    const userCount = await User.count({ where: { roleId: id } });
    if (userCount > 0) {
      return res.status(400).json({
        message: `Role gagal dihapus. Masih ada ${userCount} user yang menggunakan role ini.`,
        description: "Pindahkan user ke role lain terlebih dahulu.",
      });
    }

    await role.destroy();
    res.status(200).json({ message: "Role berhasil dihapus selamanya." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Proses hapus gagal.", error: error.message });
  }
};
