const userService = require("../services/userService");

/**
 * Handle custom service errors and map them to appropriate HTTP responses
 */
const handleServiceError = (res, error) => {
  console.error("[USER SERVICE ERROR]:", error.message || error);
  const msg = error.message;
  
  if (msg.startsWith("NOT_FOUND")) return res.status(404).json({ message: msg.split(": ")[1] });
  if (msg.startsWith("ACCESS_DENIED") || msg.startsWith("FORBIDDEN")) return res.status(403).json({ message: msg.split(": ")[1] });
  if (msg.startsWith("BAD_REQUEST") || msg.startsWith("CONFLICT")) return res.status(400).json({ message: msg.split(": ")[1] });
  
  return res.status(500).json({ message: "Internal server error." });
};

// Retrieve sanitized user registry with associated role metadata
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    handleServiceError(res, error);
  }
};

// Whitelist external SSO identities for subsequent system synchronization
exports.createUser = async (req, res) => {
  try {
    const result = await userService.createUser(req.body, req.userRole);
    res.status(201).json({
      success: true,
      message: `User '${result.owl_username}' berhasil di-whitelist.`,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// Execute scoped profile mutations with privilege escalation guards
exports.updateUser = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body, req.userId, req.userRole);
    res.json({
      success: true,
      message: `User ${user.name} berhasil diperbarui.`,
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};

// Terminate user accounts while enforcing system stability and rank constraints
exports.deleteUser = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id, req.userId, req.userRole);
    res.json({
      success: true,
      message: "User has been deleted permanently.",
    });
  } catch (error) {
    handleServiceError(res, error);
  }
};
