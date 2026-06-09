const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/User");
const Role = require("../models/Role");

class AuthService {
  getPermissionsByRole(role) {
    const normalizedRole = role ? String(role).toLowerCase().trim() : "";
    const common = ["dashboard", "manage_inbox"];
    const content = [
      "manage_businesses",
      "manage_projects",
      "manage_investments",
      "manage_content",
      "manage_homepage",
      "manage_about",
      "manage_philosophy",
      "manage_achievements",
      "manage_settings",
      "manage_news",
    ];

    if (normalizedRole === "superadmin" || normalizedRole === "admin") {
      return [...common, ...content, "manage_approvals", "manage_users"];
    }

    if (normalizedRole === "editor") return [...common, ...content];
    if (normalizedRole === "approver") return ["dashboard", "manage_approvals"];

    return ["dashboard"];
  }

  /* Implements hybrid authentication merging external ERP verification with local registry checks.*/
  async loginViaERP(uname, password) {
    const baseUrl = process.env.DAW_NODE_URL;

    if (!baseUrl) {
      throw new Error("INTERNAL: DAW_NODE_URL is not defined in environment.");
    }

    // Phase 1: Authenticate credentials against external ERP Node
    let owlResponse;
    try {
      owlResponse = await axios.post(`${baseUrl}/node/auth/login`, {
        uname,
        password,
      });
    } catch (owlError) {
      const errorDetail =
        owlError.response?.data?.message || "Koneksi server gagal.";
      throw new Error(
        `AUTH_FAILED: Gagal Login: Username atau Password OWL salah!|${errorDetail}`,
      );
    }

    const owlData = owlResponse.data;

    // [DIAGNOSTIC] Temporary logging to debug first-time login OWL response shape
    // console.log("[OWL DEBUG] HTTP Status:", owlResponse.status);
    // console.log("[OWL DEBUG] Response keys:", Object.keys(owlData));
    // console.log(
    //   "[OWL DEBUG] owlData.data:",
    //   owlData.data ? "(token present)" : owlData.data,
    // );
    // console.log("[OWL DEBUG] owlData.error:", owlData.error);
    // console.log("[OWL DEBUG] owlData.message:", owlData.message);
    // console.log(
    //   "[OWL DEBUG] owlData.token:",
    //   owlData.token ? "(token present)" : owlData.token,
    // );
    // console.log(
    //   "[OWL DEBUG] Full response:",
    //   JSON.stringify(owlData, null, 2),
    // );

    const tokenDiterima = owlData.data;

    // Jika OWL mengembalikan error (misal: "Account Not Found!" atau error lainnya)
    if (owlData.error) {
      const owlMessage =
        owlData.response || owlData.message || "Unknown OWL error.";
      throw new Error(`AUTH_FAILED: Gagal Login via OWL: ${owlMessage}`);
    }

    if (!tokenDiterima) {
      throw new Error("AUTH_FAILED: Gagal mendapatkan token akses dari OWL.");
    }

    // Phase 2: Decode external JWT and validate user existence in local database
    const decodedOwlToken = jwt.decode(tokenDiterima) || {};

    const user = await User.findOne({
      where: { owl_username: uname },
      include: [
        {
          model: Role,
          as: "roleData",
        },
      ],
    });

    if (!user) {
      throw new Error(
        "FORBIDDEN: Akses Ditolak: User OWL terverifikasi, tapi tidak memiliki akses ke CMS DAW.",
      );
    }

    if (!user.roleData) {
      throw new Error(
        "INTERNAL: Akses Ditolak: User role belum dikonfigurasi di CMS.",
      );
    }

    // Phase 3: Synchronize local profile metadata with external identity provider
    const updatedName = decodedOwlToken.name || user.name;
    const updatedEmail = decodedOwlToken.email || user.email;
    const updatePayload = { lastLogin: new Date() };

    if (
      user.name !== updatedName ||
      (updatedEmail && user.email !== updatedEmail)
    ) {
      updatePayload.name = updatedName;
      updatePayload.email = updatedEmail;
    }

    await user.update(updatePayload);

    // Phase 4: Generate local JWT with injected permissions and ERP cross-reference tokens
    const actualRole = user.roleData.name;
    const normalizedRole = actualRole.toLowerCase().trim();
    const permissions = this.getPermissionsByRole(actualRole);

    const nikDariOwl =
      decodedOwlToken.karyawanid ||
      decodedOwlToken.karyawanId ||
      decodedOwlToken.userid;

    const cmsToken = jwt.sign(
      {
        id: user.id,
        name: user.name,
        owl_username: user.owl_username,
        role: normalizedRole,
        permissions: permissions,
        owl_token: tokenDiterima,
        karyawanid: nikDariOwl,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "24h" },
    );

    return {
      token: cmsToken,
      user: {
        name: user.name,
        role: normalizedRole,
        permissions: permissions,
      },
    };
  }

  /* Retrieve authenticated session metadata from local database */
  async getMe(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: "roleData" }],
    });

    if (!user) throw new Error("NOT_FOUND: User not found.");

    const actualRole = user.roleData ? user.roleData.name : user.role;
    const normalizedRole = actualRole.toLowerCase().trim();
    const permissions = this.getPermissionsByRole(normalizedRole);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: normalizedRole,
      permissions: permissions,
      status: user.status,
    };
  }
}

module.exports = new AuthService();
