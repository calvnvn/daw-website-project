const User = require("../models/User");
const Role = require("../models/Role");

class UserService {
  /**
   * Retrieve sanitized user registry with associated role metadata.
   * Excludes password hashes from the result set.
   * @returns {Array} List of users
   */
  async getAllUsers() {
    return await User.findAll({
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
  }

  /**
   * Whitelist external SSO identities for subsequent system synchronization.
   * Initializes an unauthenticated placeholder record.
   * @param {Object} payload - User creation payload
   * @param {string} requesterRole - The role of the user requesting the action
   * @returns {Object} Created user data
   * @throws {Error} If permission denied, missing fields, or user exists
   */
  async createUser(payload, requesterRole) {
    const { email, roleId, owl_username } = payload;

    if (requesterRole !== "superadmin" && requesterRole !== "owner") {
      throw new Error("ACCESS_DENIED: Hanya superadmin atau owner yang berwenang mendaftarkan user baru.");
    }

    if (!owl_username) {
      throw new Error("BAD_REQUEST: OWL Username wajib diisi untuk sinkronisasi SSO.");
    }

    const existingUser = await User.findOne({ where: { owl_username } });
    if (existingUser) {
      throw new Error(`CONFLICT: Username OWL '${owl_username}' sudah terdaftar.`);
    }

    return await User.create({
      name: "Menunggu Sync Login...",
      email: email && email.trim() !== "" ? email : null,
      owl_username: owl_username.trim(),
      roleId: roleId,
      password: "SSO_USER_NO_LOCAL_LOGIN",
      status: "Active",
    });
  }

  /**
   * Execute scoped profile mutations with privilege escalation guards.
   * @param {number|string} targetId - ID of the user to update
   * @param {Object} payload - Update payload
   * @param {number|string} requesterId - ID of the requesting user
   * @param {string} requesterRole - Role of the requesting user
   * @returns {Object} The updated user instance
   * @throws {Error} If user not found, unauthorized, or validation fails
   */
  async updateUser(targetId, payload, requesterId, requesterRole) {
    const { name, email, roleId, status } = payload;

    const user = await User.findByPk(targetId, {
      include: [{ model: Role, as: "roleData" }],
    });

    if (!user) {
      throw new Error("NOT_FOUND: User not found");
    }

    const targetRoleName = user.roleData?.name?.toLowerCase() || "";
    const targetIsSuperadmin = targetRoleName === "superadmin";
    const targetIsOwner = targetRoleName === "owner";
    const isEditingSelf = String(requesterId) === String(targetId);

    // 1. Anti-Self-Demotion / Suspension: Prevent users (especially superadmins/owners) from altering their own critical access vectors
    if (isEditingSelf && (roleId || status)) {
      throw new Error("FORBIDDEN: Demi keamanan, Anda tidak diizinkan mengubah Role atau Status akun Anda sendiri.");
    }

    // 2. Enforce immutable state for Owner and Superadmin records
    if (targetIsOwner && !isEditingSelf) {
      if (requesterRole !== "owner") {
        throw new Error("FORBIDDEN: Akun owner hanya bisa diubah oleh Owner lainnya.");
      }
    }

    if (targetIsSuperadmin && !isEditingSelf) {
      if (requesterRole !== "owner") {
        throw new Error("FORBIDDEN: Akun superadmin hanya bisa diubah oleh Owner.");
      }
    }

    // 3. Whitelist Privilege Escalation: Strictly restrict Role and Status modifications to superadmins and owners only
    if (requesterRole !== "superadmin" && requesterRole !== "owner" && (roleId || status)) {
      throw new Error("FORBIDDEN: Hanya Superadmin atau Owner yang berwenang mengubah Role atau Status akun.");
    }

    // Map and synchronize only defined delta fields to the persistence layer
    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (roleId !== undefined) updatePayload.roleId = roleId;
    if (status !== undefined) updatePayload.status = status;

    if (Object.keys(updatePayload).length === 0) {
      throw new Error("BAD_REQUEST: No valid fields provided for update.");
    }

    await user.update(updatePayload);
    return user;
  }

  /**
   * Terminate user accounts while enforcing system stability and rank constraints.
   * @param {number|string} targetId - ID of the user to delete
   * @param {number|string} requesterId - ID of the requesting user
   * @param {string} requesterRole - Role of the requesting user
   * @returns {boolean} Success status
   * @throws {Error} If validation fails or unauthorized
   */
  async deleteUser(targetId, requesterId, requesterRole) {
    const user = await User.findByPk(targetId, {
      include: [{ model: Role, as: "roleData" }],
    });
    
    if (!user) {
      throw new Error("NOT_FOUND: User not found");
    }

    if (String(requesterId) === String(targetId)) {
      throw new Error("FORBIDDEN: You cannot delete your own account!");
    }

    if (user.roleData?.name === "owner") {
      throw new Error("FORBIDDEN: owner accounts are protected.");
    }

    if (user.roleData?.name === "superadmin") {
      if (requesterRole !== "owner") {
        throw new Error("FORBIDDEN: superadmin accounts can only be deleted by an owner.");
      }
    }

    if (requesterRole !== "superadmin" && requesterRole !== "owner") {
      throw new Error("FORBIDDEN: Only superadmin or owner can delete users.");
    }

    await user.destroy();
    return true;
  }
}

module.exports = new UserService();
