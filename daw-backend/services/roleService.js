const Role = require("../models/Role");
const User = require("../models/User");

class RoleService {
  async getAllRoles() {
    return await Role.findAll({
      attributes: ["id", "name", "description"],
      order: [["name", "ASC"]],
    });
  }

  async createRole(body) {
    const { name, description } = body;
    if (!name) throw new Error("VALIDATION_ERROR: Nama role wajib diisi.");
    return await Role.create({ name, description });
  }

  async updateRole(id, body) {
    const { name, description } = body;
    const role = await Role.findByPk(id);
    if (!role) throw new Error("NOT_FOUND: Role tidak ditemukan.");

    if (role.name === "superadmin" && name !== "superadmin") {
      throw new Error("FORBIDDEN: Dilarang mengubah nama role sistem (superadmin).");
    }

    await role.update({ name, description });
    return { success: true };
  }

  async deleteRole(id) {
    const role = await Role.findByPk(id);
    if (!role) throw new Error("NOT_FOUND: Role tidak ditemukan.");

    if (["superadmin", "Editor", "Approver"].includes(role.name)) {
      throw new Error(`FORBIDDEN: Role sistem '${role.name}' dilindungi dan tidak dapat dihapus.`);
    }

    const userCount = await User.count({ where: { roleId: id } });
    if (userCount > 0) {
      throw new Error(`VALIDATION_ERROR: Role gagal dihapus. Masih ada ${userCount} user yang menggunakan role ini.`);
    }

    await role.destroy();
    return { success: true };
  }
}

module.exports = new RoleService();
