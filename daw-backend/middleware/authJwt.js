const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    // 1. Ambil header (Standardisasi: prioritaskan Authorization)
    const authHeader =
      req.headers["authorization"] || req.headers["x-access-token"];

    // DEBUG 1: Liat apa yang dikirim Frontend
    console.log("[DEBUG] Header Masuk:", authHeader);

    if (!authHeader) {
      return res.status(403).json({ message: "No token provided!" });
    }

    // 2. Ekstraksi token yang lebih cerdas (Handle case-insensitive "bearer")
    let token = authHeader;
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.split(" ")[1]; // Ambil kata kedua setelah spasi
    }

    // DEBUG 2: Liat token setelah dibersihin
    console.log("[DEBUG] Token Terproses:", `"${token}"`);

    // 3. Pastikan token tidak kosong atau string "undefined"
    if (!token || token === "undefined" || token === "null") {
      console.error("[ERROR] Token formatnya sampah (undefined/null/empty)");
      return res.status(401).json({ message: "Invalid token format!" });
    }

    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      console.error("[FATAL ERROR]: JWT_SECRET is missing!");
      return res.status(500).json({ message: "Server configuration error" });
    }

    // 4. Verifikasi
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        // Bedakan log antara expired dan malformed buat mempermudah debugging
        const errorType =
          err.name === "TokenExpiredError" ? "EXPIRED" : "INVALID/MALFORMED";
        console.error(`[JWT ERROR] ${errorType}:`, err.message);

        return res.status(401).json({
          message: `Unauthorized! Token is ${err.name === "TokenExpiredError" ? "expired" : "invalid"}.`,
        });
      }

      // 5. Validasi isi payload (Jangan langsung percaya decoded)
      if (!decoded.id || !decoded.role) {
        return res
          .status(401)
          .json({ message: "Unauthorized! Token payload is incomplete." });
      }

      req.userId = decoded.id;
      req.userRole = decoded.role;
      next();
    });
  } catch (error) {
    console.error("[MIDDLEWARE CRASH]", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error in Middleware" });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // req.userRole didapat dari fungsi verifyToken sebelumnya
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        message: `Forbidden! Role '${req.userRole}' does not have access to this action.`,
      });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles };
