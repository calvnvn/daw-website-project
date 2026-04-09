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
    const decoded = jwt.decode(token);

    if (!decoded) {
      console.error(
        "❌ [OWL ERROR] Gagal membaca isi token. Struktur token bukan JWT yang valid.",
      );
      return res.status(401).json({ message: "Invalid token payload!" });
    }

    // 4. Sinkronisasi Data (Mapping field dari Payload JWT Mas Umar ke CMS)
    // Pastikan key-nya sesuai dengan yang ada di payload Mas Umar
    req.userId = decoded.userid;
    req.userRole = decoded.role; // Akan berisi "admin"
    req.userName = decoded.name || "User OWL";
    req.userPermissions = decoded.permissions || [];

    // Debugging di terminal backend
    // console.log(
    //   `🔓 [LOCAL DECODE SUCCESS] User: ${req.userName} | Role: ${req.userRole}`,
    // );

    next();
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
    if (req.userRole === "admin" || req.userRole === "Superadmin") {
      return next();
    }

    // 2. Cek permission jika ada sistem permission khusus
    if (!req.userPermissions.includes(requiredPermission)) {
      return res.status(403).json({
        message: `Forbidden! Access denied for: ${requiredPermission}`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, checkPermission };
