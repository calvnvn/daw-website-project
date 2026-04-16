const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/User");
const Role = require("../models/Role");
const { Op } = require("sequelize");

// Mapping Permission sesuai request lo
function getPermissionsByRole(role) {
  const common = ["dashboard"];

  // Menu yang bisa diakses Editor & Superadmin
  const editorContent = [
    "manage_inbox",
    "manage_businesses",
    "manage_projects",
    "manage_investments",
    "manage_content",
    "manage_homepage",
    "manage_about",
    "manage_settings",
  ];

  if (role === "Superadmin") {
    return [
      ...common,
      ...editorContent,
      "manage_approvals", // Read-only mode di UI
      "manage_users", // Akses User & Roles
    ];
  }

  if (role === "Editor") {
    return [...common, ...editorContent];
  }

  if (role === "Approver") {
    return ["dashboard", "manage_approvals"];
  }

  return ["dashboard"];
}

// 1. LOGIN (Hybrid: Local & OWL)
exports.login = async (req, res) => {
  try {
    const { uname, password } = req.body;
    const baseUrl = process.env.DAW_NODE_URL;

    console.log(`>>> [AUTH] Verifying ${uname} via OWL ERP at ${baseUrl}...`);

    try {
      const owlResponse = await axios.post(`${baseUrl}/node/auth/login`, {
        uname: uname,
        password: password,
      });

      // Jika OWL sukses, kita dapet data user dan token dari sana
      console.log(
        ">>> [DEBUG] FULL OWL RESPONSE:",
        JSON.stringify(owlResponse.data, null, 2),
      );

      const owlData = owlResponse.data;
      const tokenDiterima = owlData.data;

      if (!tokenDiterima || owlData.error) {
        return res.status(401).json({
          message: "Gagal mendapatkan akses dari OWL.",
        });
      }

      const decodedOwlToken = jwt.decode(tokenDiterima);
      console.log(">>> [DEBUG] Decoded Content:", decodedOwlToken);

      let user = await User.findOne({
        where: { owl_username: uname },
        include: [
          {
            model: Role,
            as: "roleData",
          },
        ],
      });

      if (!user) {
        return res.status(403).json({
          message:
            "User OWL terverifikasi, tapi tidak memiliki akses ke CMS DAW.",
        });
      }

      // Syncing OWL's Token Identity

      if (decodedOwlToken) {
        const updatedName = decodedOwlToken.name || user.name;
        const updatedEmail = decodedOwlToken.email || user.email;

        const updatePayload = {
          lastLogin: new Date(),
        };

        if (
          user.name !== updatedName ||
          (updatedEmail && user.email !== updatedEmail)
        ) {
          console.log(
            `>>> [AUTH SYNC] Data profil berubah, menyamakan dengan OWL...`,
          );
          updatePayload.name = updatedName;
          updatePayload.email = updatedEmail;
        }

        await user.update(updatePayload);

        user.lastLogin = updatePayload.lastLogin;
        if (updatePayload.name) user.name = updatePayload.name;
        if (updatePayload.email) user.email = updatePayload.email;
      }

      if (!user.roleData) {
        return res
          .status(500)
          .json({ message: "User role configuration error." });
      }

      const actualRole = user.roleData.name;
      console.log(`>>> [AUTH] User ${uname} detected as: ${actualRole}`);
      const permissions = getPermissionsByRole(actualRole);

      // Generate CMS TOKEN
      const cmsToken = jwt.sign(
        {
          id: user.id,
          name: user.name,
          owl_username: user.owl_username,
          role: actualRole,
          permissions: permissions,
          owl_token: tokenDiterima,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      );

      return res.status(200).json({
        message: "Login Berhasil via OWL!",
        token: cmsToken,
        user: {
          name: user.name,
          role: actualRole,
          permissions: permissions,
        },
      });
    } catch (owlError) {
      console.error(
        "❌ [OWL AUTH FAILED]:",
        owlError.response?.data || owlError.message,
      );
      return res.status(401).json({
        message: "Gagal Login: Username atau Password OWL salah!",
        detail: owlError.response?.data?.message,
      });
    }
  } catch (error) {
    console.error("🚨 [AUTH CRASH]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// 2. GET ME (Identitas Sesi)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: [{ model: Role, as: "roleData" }],
    });
    if (!user) return res.status(404).json({ message: "User not found." });
    const actualRole = user.roleData ? user.roleData.name : user.role;
    const permissions = getPermissionsByRole(actualRole);

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: actualRole,
      permissions: permissions,
      status: user.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🛠️ HELPER: Mapping Permission Berdasarkan Role (Tanpa Tabel DB)
function getPermissionsByRole(role) {
  const common = ["dashboard", "manage_inbox"];
  const content = [
    "manage_businesses",
    "manage_projects",
    "manage_investments",
    "manage_content",
    "manage_homepage",
    "manage_about",
    "manage_settings",
  ];

  if (role === "Superadmin")
    return [...common, ...content, "manage_approvals", "manage_users"];
  if (role === "Editor") return [...common, ...content];
  if (role === "Approver") return ["dashboard", "manage_approvals"];
  return [];
}
