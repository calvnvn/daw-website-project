const NewsCategory = require("../models/NewsCategory");
const { Op } = require("sequelize");

class NewsCategoryService {
  async getAllCategories() {
    return await NewsCategory.findAll({
      order: [["orderIndex", "ASC"], ["name", "ASC"]],
    });
  }

  async createCategory(body) {
    const { name, color, orderIndex } = body;

    if (!name || !name.trim()) throw new Error("VALIDATION_ERROR: Nama kategori wajib diisi.");

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    const existing = await NewsCategory.findOne({
      where: { [Op.or]: [{ name: name.trim() }, { slug }] },
    });

    if (existing) throw new Error("CONFLICT: Kategori dengan nama ini sudah ada.");

    return await NewsCategory.create({
      name: name.trim(),
      slug,
      color: color || "#004B23",
      orderIndex: orderIndex || 0,
    });
  }

  async updateCategory(id, body) {
    const { name, color, orderIndex } = body;
    const category = await NewsCategory.findByPk(id);
    if (!category) throw new Error("NOT_FOUND: Kategori tidak ditemukan.");

    const updates = {};

    if (name && name.trim() !== category.name) {
      updates.name = name.trim();
      updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

      const duplicate = await NewsCategory.findOne({
        where: {
          [Op.or]: [{ name: updates.name }, { slug: updates.slug }],
          id: { [Op.ne]: id },
        },
      });

      if (duplicate) throw new Error("CONFLICT: Kategori dengan nama ini sudah ada.");
    }

    if (color !== undefined) updates.color = color;
    if (orderIndex !== undefined) updates.orderIndex = orderIndex;

    await category.update(updates);
    return category;
  }

  async deleteCategory(id) {
    const category = await NewsCategory.findByPk(id);
    if (!category) throw new Error("NOT_FOUND: Kategori tidak ditemukan.");
    await category.destroy();
    return { success: true };
  }
}

module.exports = new NewsCategoryService();
