const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    const authHeader =
      req.headers["authorization"] || req.headers["x-access-token"];

    if (!authHeader || typeof authHeader !== "string") {
      return res
        .status(401)
        .json({ message: "Unauthorized! Token is missing." });
    }

    let token = authHeader;
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token || token === "undefined" || token === "null") {
      return res
        .status(401)
        .json({ message: "Unauthorized! Invalid token format." });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error(
          `❌ [AUTH ERROR] Token Verification Failed: ${err.message}`,
        );

        if (err.name === "TokenExpiredError") {
          return res
            .status(401)
            .json({ message: "Token has expired! Please login again." });
        }
        return res
          .status(401)
          .json({ message: "Unauthorized Access! Invalid token signature." });
      }

      const rawRole = decoded.role
        ? String(decoded.role).toLowerCase().trim()
        : "";

      const normalizedRole = rawRole === "admin" ? "superadmin" : rawRole;

      req.userId = decoded.id;
      req.owl_username = decoded.owl_username || decoded.username;

      req.karyawanId =
        decoded.karyawanid || decoded.karyawanId || decoded.userid;

      req.userRole = normalizedRole;
      req.userPermissions = Array.isArray(decoded.permissions)
        ? decoded.permissions
        : [];
      req.owl_token = decoded.owl_token;

      console.log(
        `✅ [AUTH SUCCESS] User: ${req.owl_username} | Internal Role: ${req.userRole}`,
      );

      next();
    });
  } catch (error) {
    console.error("🚨 [MIDDLEWARE CRASH]", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error in Middleware" });
  }
};

/**
 * Middleware untuk mengecek hak akses spesifik
 */
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (req.userRole === "superadmin" || req.userRole === "admin") {
      return next();
    }

    if (req.userRole === "editor" && req.method === "GET") {
      return next();
    }
    const permissions = req.userPermissions || [];
    if (!permissions.includes(requiredPermission)) {
      console.warn(
        `⚠️ [403] User ${req.owl_username} ditolak akses ${requiredPermission}`,
      );
      return res.status(403).json({
        message: `Forbidden! Anda tidak memiliki izin '${requiredPermission}'.`,
      });
    }

    next();
  };
};

module.exports = { verifyToken, checkPermission };
