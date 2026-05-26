const roleService = require("../services/roleService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ message: msg.split(": ")[1] });
  }

  if (msg.startsWith("FORBIDDEN")) {
    return res.status(403).json({ message: msg.split(": ")[1] });
  }

  if (msg.startsWith("VALIDATION_ERROR")) {
    return res.status(400).json({ message: msg.split(": ")[1] });
  }

  console.error(`🚨 [ROLE ERROR]:`, msg);
  res.status(500).json({ message: defaultMsg || msg, error: msg });
};

exports.getAllRoles = async (req, res) => {
  try {
    const data = await roleService.getAllRoles();
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch roles");
  }
};

exports.createRole = async (req, res) => {
  try {
    const data = await roleService.createRole(req.body);
    res.status(201).json({ success: true, message: "Role baru berhasil dibuat.", data });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat role.");
  }
};

exports.updateRole = async (req, res) => {
  try {
    await roleService.updateRole(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Role berhasil diperbarui." });
  } catch (error) {
    handleServiceError(res, error, "Update gagal.");
  }
};

exports.deleteRole = async (req, res) => {
  try {
    await roleService.deleteRole(req.params.id);
    res.status(200).json({ message: "Role berhasil dihapus selamanya." });
  } catch (error) {
    handleServiceError(res, error, "Proses hapus gagal.");
  }
};
