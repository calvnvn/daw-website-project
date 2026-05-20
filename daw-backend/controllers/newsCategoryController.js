const NewsCategory = require("../models/NewsCategory");
const { Op } = require("sequelize");

// Fetch all categories for admin management
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await NewsCategory.findAll({
      order: [["orderIndex", "ASC"], ["name", "ASC"]],
    });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name, color, orderIndex } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Nama kategori wajib diisi." });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const existing = await NewsCategory.findOne({
      where: { [Op.or]: [{ name: name.trim() }, { slug }] },
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: "Kategori dengan nama ini sudah ada." });
    }

    const category = await NewsCategory.create({
      name: name.trim(),
      slug,
      color: color || "#004B23",
      orderIndex: orderIndex || 0,
    });

    res.status(201).json({ message: "Kategori berhasil dibuat.", data: category });
  } catch (error) {
    console.error("🚨 Error CREATE NewsCategory:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Update an existing category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, orderIndex } = req.body;

    const category = await NewsCategory.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: "Kategori tidak ditemukan." });
    }

    const updates = {};

    if (name && name.trim() !== category.name) {
      updates.name = name.trim();
      updates.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");

      // Check uniqueness against other categories
      const duplicate = await NewsCategory.findOne({
        where: {
          [Op.or]: [{ name: updates.name }, { slug: updates.slug }],
          id: { [Op.ne]: id },
        },
      });

      if (duplicate) {
        return res
          .status(409)
          .json({ message: "Kategori dengan nama ini sudah ada." });
      }
    }

    if (color !== undefined) updates.color = color;
    if (orderIndex !== undefined) updates.orderIndex = orderIndex;

    await category.update(updates);

    res.status(200).json({ message: "Kategori berhasil diperbarui.", data: category });
  } catch (error) {
    console.error("🚨 Error UPDATE NewsCategory:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await NewsCategory.findByPk(id);
    if (!category) {
      return res.status(404).json({ message: "Kategori tidak ditemukan." });
    }

    await category.destroy();

    res.status(200).json({ message: "Kategori berhasil dihapus." });
  } catch (error) {
    console.error("🚨 Error DELETE NewsCategory:", error.message);
    res.status(500).json({ message: error.message });
  }
};
