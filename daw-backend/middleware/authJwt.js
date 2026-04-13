const axios = require("axios");
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    const authHeader =
      req.headers["authorization"] || req.headers["x-access-token"];

    if (!authHeader) {
      return res.status(403).json({ message: "No token provided!" });
    }

    let token = authHeader;
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({ message: "Invalid token format!" });
    }

    // 3. LOCAL DECODING (The Magic Bypass)
    // jwt.decode() HANYA membaca isi paket, TANPA mengecek tanda tangan (Secret)
    // const decoded = jwt.decode(token);

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error(
          "❌ [AUTH ERROR] Token Verification Failed:",
          err.message,
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

      req.userId = decoded.userid;
      req.userRole = decoded.role; // Akan berisi "admin"
      req.userName = decoded.name || "User OWL";
      req.userPermissions = decoded.permissions || [];
      next();
    });
  } catch (error) {
    console.error("[MIDDLEWARE CRASH]", error);
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
    // 1. Logic bypass untuk Role 'admin' (karena dari OWL rolenya 'admin')
    const isAdmin = req.userRole === "admin" || req.userRole === "Superadmin";

    if (isAdmin) {
      return next();
    }

    const permissions = Array.isArray(req.userPermissions)
      ? req.userPermissions
      : [];

    if (!permissions.includes(requiredPermission)) {
      return res.status(403).json({
        message: `Forbidden! You need '${requiredPermission}' permission to perform this action.`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, checkPermission };
