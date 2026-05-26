const authService = require("../services/authService");

/**
 * Handle custom service errors and map them to appropriate HTTP responses
 */
const handleAuthError = (res, error) => {
  const msg = error.message;

  if (msg.startsWith("AUTH_FAILED")) {
    const parts = msg.split("AUTH_FAILED: ")[1].split("|");
    return res.status(401).json({
      message: parts[0],
      detail: parts[1] || null,
    });
  }

  if (msg.startsWith("FORBIDDEN"))
    return res.status(403).json({ message: msg.split(": ")[1] });
  if (msg.startsWith("NOT_FOUND"))
    return res.status(404).json({ message: msg.split(": ")[1] });

  console.error("🚨 [AUTH CRASH]:", error.message || error);
  return res.status(500).json({ message: "Internal Server Error" });
};

// Implement hybrid authentication merging external ERP verification with local registry checks
exports.login = async (req, res) => {
  try {
    const { uname, password } = req.body;
    // console.log(`>>> [AUTH] Verifying ${uname} via OWL...`);

    const result = await authService.loginViaERP(uname, password);

    return res.status(200).json({
      message: "Login Berhasil via OWL!",
      ...result,
    });
  } catch (error) {
    handleAuthError(res, error);
  }
};

// Retrieve authenticated session metadata from local database
exports.getMe = async (req, res) => {
  try {
    const sessionData = await authService.getMe(req.userId);
    res.status(200).json(sessionData);
  } catch (error) {
    handleAuthError(res, error);
  }
};
