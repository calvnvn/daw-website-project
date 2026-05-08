const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/User");
const Role = require("../models/Role");

// Map authorization permissions based on normalized role definitions
function getPermissionsByRole(role) {
  const normalizedRole = role ? String(role).toLowerCase().trim() : "";
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

  if (normalizedRole === "superadmin" || normalizedRole === "admin") {
    return [...common, ...content, "manage_approvals", "manage_users"];
  }

  if (normalizedRole === "editor") return [...common, ...content];
  if (normalizedRole === "approver") return ["dashboard", "manage_approvals"];

  return ["dashboard"];
}

// Implement hybrid authentication merging external ERP verification with local registry checks
exports.login = async (req, res) => {
  try {
    const { uname, password } = req.body;
    const baseUrl = process.env.DAW_NODE_URL;

    if (!baseUrl) {
      throw new Error("DAW_NODE_URL is not defined in environment.");
    }

    console.log(`>>> [AUTH] Verifying ${uname} via OWL...`);

    // Phase 1: Authenticate credentials against external ERP Node
    let owlResponse;
    try {
      owlResponse = await axios.post(`${baseUrl}/node/auth/login`, {
        uname,
        password,
      });
    } catch (owlError) {
      console.error(
        "❌ [OWL AUTH FAILED]:",
        owlError.response?.data || owlError.message,
      );
      return res.status(401).json({
        message: "Gagal Login: Username atau Password OWL salah!",
        detail: owlError.response?.data?.message || "Koneksi server gagal.",
      });
    }

    const owlData = owlResponse.data;
    const tokenDiterima = owlData.data;

    if (!tokenDiterima || owlData.error) {
      return res.status(401).json({
        message: "Gagal mendapatkan token akses dari OWL.",
      });
    }

    // Phase 2: Decode external JWT and validate user existence in local database
    const decodedOwlToken = jwt.decode(tokenDiterima) || {};
    console.log(">>> [DEBUG] Decoded Content:", decodedOwlToken);
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
      return res.status(403).json({
        message:
          "Akses Ditolak: User OWL terverifikasi, tapi tidak memiliki akses ke CMS DAW.",
      });
    }

    if (!user.roleData) {
      return res.status(500).json({
        message: "Akses Ditolak: User role belum dikonfigurasi di CMS.",
      });
    }

    // Phase 3: Synchronize local profile metadata with external identity provider
    const updatedName = decodedOwlToken.name || user.name;
    const updatedEmail = decodedOwlToken.email || user.email;
    const updatePayload = { lastLogin: new Date() };

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

    // Phase 4: Generate local JWT with injected permissions and ERP cross-reference tokens
    const actualRole = user.roleData.name;
    const normalizedRole = actualRole.toLowerCase().trim();
    const permissions = getPermissionsByRole(actualRole);

    const nikDariOwl =
      decodedOwlToken.karyawanid ||
      decodedOwlToken.karyawanId ||
      decodedOwlToken.userid;

    console.log(">>> [AUDIT IDENTITAS] Isi Decoded OWL:", {
      userid: decodedOwlToken.userid,
      karyawanid: decodedOwlToken.karyawanid,
      name: decodedOwlToken.name,
    });

    const cmsToken = jwt.sign(
      {
        id: user.id,
        name: user.name,
        owl_username: user.owl_username,
        role: normalizedRole,
        permissions: permissions,
        owl_token: tokenDiterima,
        karyawanid: nikDariOwl, // Required for approval service identification
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.status(200).json({
      message: "Login Berhasil via OWL!",
      token: cmsToken,
      user: {
        name: user.name,
        role: normalizedRole,
        permissions: permissions,
      },
    });
  } catch (error) {
    console.error("🚨 [AUTH CRASH]:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Retrieve authenticated session metadata from local database
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: [{ model: Role, as: "roleData" }],
    });

    if (!user) return res.status(404).json({ message: "User not found." });

    const actualRole = user.roleData ? user.roleData.name : user.role;
    const normalizedRole = actualRole.toLowerCase().trim();
    const permissions = getPermissionsByRole(normalizedRole);

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: normalizedRole,
      permissions: permissions,
      status: user.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
