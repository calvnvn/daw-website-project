const menuService = require("../services/menuService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("VALIDATION_ERROR")) {
    return res.status(400).json({ success: false, message: msg.split(": ")[1] });
  }

  console.error(`🚨 [MENU ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg, error: msg });
};

exports.getMenuTree = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await menuService.getMenuTree(lang);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat struktur menu");
  }
};

exports.getAllMenusFlat = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await menuService.getAllMenusFlat(lang);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat daftar menu");
  }
};

exports.createMenu = async (req, res) => {
  try {
    const newMenu = await menuService.createMenu(req.body);
    res.status(201).json({
      success: true,
      message: "Menu berhasil ditambahkan secara live!",
      menu: newMenu,
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat menu");
  }
};

exports.updateMenu = async (req, res) => {
  try {
    await menuService.updateMenu(req.params.id, req.body);
    res.status(200).json({ success: true, message: "Menu diperbarui secara live!" });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui menu");
  }
};

exports.deleteMenu = async (req, res) => {
  try {
    await menuService.deleteMenu(req.params.id);
    res.status(200).json({ success: true, message: "Menu beserta sub-menunya berhasil dihapus." });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus menu");
  }
};

exports.reorderMenus = async (req, res) => {
  try {
    await menuService.reorderMenus(req.body.updatedMenus);
    res.status(200).json({ success: true, message: "Struktur navigasi berhasil disimpan secara live!" });
  } catch (error) {
    handleServiceError(res, error, "Gagal menyimpan urutan navigasi");
  }
};
