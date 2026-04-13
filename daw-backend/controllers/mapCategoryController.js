const MapCategory = require("../models/MapCategory");

// Ambil semua kategori (untuk dropdown di admin & legend di public)
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await MapCategory.findAll({ order: [["name", "ASC"]] });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Tambah Kategori Baru
exports.createCategory = async (req, res) => {
  try {
    const { id, name, color } = req.body;
    const newCat = await MapCategory.create({ id, name, color });
    res.status(201).json(newCat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Warna atau Nama Kategori
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const category = await MapCategory.findByPk(id);
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    // Gatekeeper: Editor Flow
    if (req.userRole && req.userRole.toLowerCase() === "editor") {
      await ErpApprovalService.createDraft(
        {
          jenisApproval: JENIS_APP_CMS,
          karyawanid: req.userId,
          module: "MapCategory",
          action: "UPDATE",
          targetId: id,
          content: { name, color },
        },
        req.headers["authorization"]?.split(" ")[1],
      );

      return res
        .status(202)
        .json({ message: "Perubahan kategori peta sedang ditinjau Admin." });
    }
    await category.update({ name, color });
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Hapus Kategori
exports.deleteCategory = async (req, res) => {
  try {
    const category = await MapCategory.findByPk(req.params.id);
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    await category.destroy();
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Cannot delete category (maybe still used by markers)",
    });
  }
};
