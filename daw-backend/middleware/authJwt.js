const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    let token = req.headers["x-access-token"] || req.headers["authorization"];

    if (!token) {
      return res.status(403).send({ message: "No token provided!" });
    }

    // Jika formatnya "Bearer <token>"
    if (token.startsWith("Bearer ")) {
      token = token.slice(7, token.length);
    }

    // Gunakan kunci dari .env, kalau tidak ada pakai fallback agar tidak crash
    const secretKey = process.env.JWT_SECRET || "rahasia_daw_2026";

    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        console.error("[JWT ERROR]", err.message); // Agar muncul di terminal backend
        return res
          .status(401)
          .send({ message: "Unauthorized! Token invalid or expired." });
      }

      // Pastikan payload token saat LOGIN mengandung 'id' dan 'role'
      req.userId = decoded.id;
      req.userRole = decoded.role;
      next();
    });
  } catch (error) {
    console.error("[MIDDLEWARE CRASH]", error);
    return res
      .status(500)
      .send({ message: "Internal Server Error in Middleware" });
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
