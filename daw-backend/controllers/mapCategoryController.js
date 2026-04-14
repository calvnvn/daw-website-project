const MapCategory = require("../models/MapCategory");
const ErpApprovalService = require("../services/erpApprovalService");


exports.getAllCategories = async (req, res) => {
  try {
    const categories = await MapCategory.findAll({ order: [["name", "ASC"]] });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.createCategory = async (req, res) => {
  try {
    const { id, name, color, status } = req.body;
    const categoryData = { id, name, color };

    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: MapCategory,
        targetId: id, // ID Kategori (Slug)
        action: "CREATE",
        payload: categoryData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Permintaan kategori baru dikirim.", ticket: result.notrans });
    }

    const newCat = await MapCategory.create(categoryData);
    res.status(201).json(newCat);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// UPDATE
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, status } = req.body;
    const category = await MapCategory.findByPk(id);

    if (!category) return res.status(404).json({ message: "Category not found" });


    if (category.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({ message: "Data sedang dikunci.", ticket: category.lock_ticket });
    }

    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: MapCategory,
        targetId: id,
        action: "UPDATE",
        payload: { name, color },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Revisi kategori dikirim ke OWL.", ticket: result.notrans });
    }

    await category.update({ name, color, is_locked: false, lock_ticket: null });
    res.status(200).json(category);
  } catch (error) { res.status(500).json({ message: error.message }); }
};

// DELETE
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await MapCategory.findByPk(id);

    if (req.userRole?.toLowerCase() === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: MapCategory,
        targetId: id,
        action: "DELETE",
        payload: { name: category.name },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Permintaan hapus kategori dikirim.", ticket: result.notrans });
    }

    await category.destroy();
    res.status(200).json({ message: "Category deleted!" });
  } catch (error) { res.status(500).json({ message: "Gagal hapus kategori (sedang digunakan marker)" }); }
};