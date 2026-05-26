const mapCategoryService = require("../services/mapCategoryService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("CONFLICT")) {
    return res.status(400).json({ success: false, message: msg.split(": ")[1] });
  }

  if (error.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({
      success: false,
      message: "Gagal hapus! Kategori ini masih digunakan oleh titik peta (markers).",
    });
  }

  console.error(`🚨 [MAP CATEGORY ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

exports.getAllCategories = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await mapCategoryService.getAllCategories(lang);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat kategori.");
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { id, name, color } = req.body;
    await mapCategoryService.createCategory(id, name, color);
    res.status(201).json({ success: true, message: "Kategori berhasil dibuat permanen." });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat kategori.");
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    await mapCategoryService.updateCategory(id, name, color);
    res.status(200).json({ success: true, message: "Kategori diperbarui secara permanen!" });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui kategori.");
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await mapCategoryService.deleteCategory(id);
    res.status(200).json({ success: true, message: "Kategori berhasil dihapus!" });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus kategori.");
  }
};
