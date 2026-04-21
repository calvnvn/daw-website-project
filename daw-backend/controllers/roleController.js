/**
 * MODULE: Role Controller (Slim Edition)
 * PURPOSE: Managing Role names and descriptions for User Assignment.
 * NOTE: Permissions are hardcoded in authController mapping.
 */
const Role = require("../models/Role");
const User = require("../models/User");

// Get All Roles (dengan list permission-nya)
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

// Create Role
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

// Update Role
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const role = await Role.findByPk(id);
    if (!role)
      return res.status(404).json({ message: "Role tidak ditemukan." });

    // 🛡️ Hierarchy Protection: Jangan biarkan user mengubah nama superadmin via API
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

// Delete Role
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findByPk(id);

    if (!role)
      return res.status(404).json({ message: "Role tidak ditemukan." });

    // 🛡️ System Protection: Role krusial DAW CMS nggak boleh dihapus
    if (["superadmin", "Editor", "Approver"].includes(role.name)) {
      return res.status(403).json({
        message: `Role sistem '${role.name}' dilindungi dan tidak dapat dihapus.`,
      });
    }

    // 🛡️ Integrity Check: Pastikan nggak ada user yang lagi pake role ini
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
