const newsCategoryService = require("../services/newsCategoryService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ message: msg.split(": ")[1] });
  }

  if (msg.startsWith("VALIDATION_ERROR")) {
    return res.status(400).json({ message: msg.split(": ")[1] });
  }

  if (msg.startsWith("CONFLICT")) {
    return res.status(409).json({ message: msg.split(": ")[1] });
  }

  console.error(`🚨 [NEWS CATEGORY ERROR]:`, msg);
  res.status(500).json({ message: defaultMsg || msg });
};

exports.getAllCategories = async (req, res) => {
  try {
    const data = await newsCategoryService.getAllCategories();
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat kategori.");
  }
};

exports.createCategory = async (req, res) => {
  try {
    const data = await newsCategoryService.createCategory(req.body);
    res.status(201).json({ message: "Kategori berhasil dibuat.", data });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat kategori.");
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const data = await newsCategoryService.updateCategory(req.params.id, req.body);
    res.status(200).json({ message: "Kategori berhasil diperbarui.", data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui kategori.");
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await newsCategoryService.deleteCategory(req.params.id);
    res.status(200).json({ message: "Kategori berhasil dihapus." });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus kategori.");
  }
};
