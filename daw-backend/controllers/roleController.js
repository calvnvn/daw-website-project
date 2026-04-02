const Role = require("../models/Role");
const Permission = require("../models/Permission");
const sequelize = require("../config/database"); // Import sequelize untuk transaksi

// Get All Roles (dengan list permission-nya)
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      include: [
        {
          model: Permission,
          as: "permissions",
          attributes: ["id", "name"],
          through: { attributes: [] },
        },
      ],
      order: [["createdAt", "ASC"]],
    });
    res.status(200).json(roles);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch roles", error: error.message });
  }
};

// Get All Available Permissions (untuk list checkbox di UI)
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.findAll({
      attributes: ["id", "name", "description"],
      order: [["name", "ASC"]],
    });
    res.status(200).json(permissions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch permissions" });
  }
};

// Create Role
exports.createRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, description, permissionIds } = req.body;

    const role = await Role.create({ name, description }, { transaction: t });

    if (
      permissionIds &&
      Array.isArray(permissionIds) &&
      permissionIds.length > 0
    ) {
      await role.setPermissions(permissionIds, { transaction: t });
    }

    await t.commit();

    res.status(201).json({ message: "Role created successfully", data: role });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Failed to create role", error: error.message });
  }
};

// Update Role
exports.updateRole = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { name, description, permissionIds } = req.body;

    const role = await Role.findByPk(id);
    if (!role) {
      await t.rollback();
      return res.status(404).json({ message: "Role not found" });
    }

    // Proteksi Superadmin
    if (role.name === "Superadmin" && name !== "Superadmin") {
      await t.rollback();
      return res.status(403).json({ message: "Cannot rename Superadmin role" });
    }

    // Update data dasar
    await role.update({ name, description }, { transaction: t });

    // Update Junction Table
    if (permissionIds && Array.isArray(permissionIds)) {
      await role.setPermissions(permissionIds, { transaction: t });
    }

    await t.commit();
    res.status(200).json({ message: "Role updated successfully" });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

// Delete Role
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findByPk(id);

    if (!role) return res.status(404).json({ message: "Role not found" });

    // PROTEKSI: Jangan biarkan role sistem dihapus
    if (["Superadmin", "Editor"].includes(role.name)) {
      return res
        .status(403)
        .json({ message: `System role '${role.name}' cannot be deleted.` });
    }

    await role.destroy();
    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message });
  }
};
