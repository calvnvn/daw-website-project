const jwt = require("jsonwebtoken");

/**
 * Middleware to authenticate requests via JWT verification and payload normalization.
 */
const verifyToken = (req, res, next) => {
  try {
    // Extract credentials from standard Authorization or legacy x-access-token headers
    const authHeader =
      req.headers["authorization"] || req.headers["x-access-token"];

    if (!authHeader || typeof authHeader !== "string") {
      return res
        .status(401)
        .json({ message: "Unauthorized! Token is missing." });
    }

    // Sanitize and strip 'Bearer ' prefix from the authorization string
    let token = authHeader;
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    if (!token || token === "undefined" || token === "null") {
      return res
        .status(401)
        .json({ message: "Unauthorized! Invalid token format." });
    }

    // Validate token signature and expiration against the system JWT_SECRET
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

      // Normalize role strings and map 'admin' to internal 'superadmin' level
      const rawRole = decoded.role
        ? String(decoded.role).toLowerCase().trim()
        : "";

      const normalizedRole = rawRole === "admin" ? "superadmin" : rawRole;

      // Populate request object with decoded identity and permission metadata for downstream use
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
 * Higher-order middleware for granular Role-Based Access Control (RBAC).
 */
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    // Implement administrative override for superadmin and admin roles
    if (req.userRole === "superadmin" || req.userRole === "admin") {
      return next();
    }

    // Grant implicit read-only access (GET) to editor roles
    if (req.userRole === "editor" && req.method === "GET") {
      return next();
    }

    // Validate presence of required permission string within user metadata
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
