const sequelize = require("../config/database");
const MapCategory = require("../models/MapCategory");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const Translation = require("../models/Translation");
const { autoTranslate } = require("./openaiService");

const MODULE_NAME = "MapCategory";

class MapCategoryService {
  async getAllCategories(lang = "en") {
    const rawCategories = await MapCategory.findAll({
      attributes: ["id", "name", "color", "is_locked", "lock_ticket"],
      order: [["name", "ASC"]],
    });

    if (lang === "en") return rawCategories;

    const translatedCategories = [];

    for (let i = 0; i < rawCategories.length; i++) {
      let cat = rawCategories[i].get({ plain: true });
      let nameTrans = await Translation.findOne({
        where: { modelName: MODULE_NAME, recordId: cat.id, field: "name", locale: "id" },
      });

      if (!nameTrans) {
        const freshName = await autoTranslate(cat.name, "Indonesian");

        if (freshName) {
          const existing = await Translation.findOne({
            where: { modelName: MODULE_NAME, recordId: cat.id, field: "name", locale: "id" },
          });
          if (existing) await existing.update({ translatedText: freshName });
          else {
            await Translation.create({
              modelName: MODULE_NAME,
              recordId: cat.id,
              field: "name",
              locale: "id",
              translatedText: freshName,
            });
          }
          cat.name = freshName;
        }
      } else {
        cat.name = nameTrans.translatedText;
      }
      translatedCategories.push(cat);
    }

    return translatedCategories;
  }

  async createCategory(id, name, color) {
    const t = await sequelize.transaction();
    try {
      const existing = await MapCategory.findByPk(id, { transaction: t });
      if (existing) {
        await t.rollback();
        throw new Error("CONFLICT: ID Kategori sudah digunakan!");
      }

      const categoryData = { id, name, color, is_locked: false };
      await MapCategory.create(categoryData, { transaction: t });
      await t.commit();
      return { success: true };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateCategory(id, name, color) {
    const t = await sequelize.transaction();
    try {
      await invalidateOldDrafts(MODULE_NAME, id, t);

      const category = await MapCategory.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!category) {
        await t.rollback();
        throw new Error("NOT_FOUND: Kategori tidak ditemukan");
      }

      await category.update(
        { name, color, is_locked: false, lock_ticket: null },
        { transaction: t }
      );

      await t.commit();
      return { success: true };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteCategory(id) {
    const t = await sequelize.transaction();
    try {
      await invalidateOldDrafts(MODULE_NAME, id, t);

      const category = await MapCategory.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!category) {
        await t.rollback();
        throw new Error("NOT_FOUND: Kategori tidak ditemukan");
      }

      await category.destroy({ transaction: t });
      await t.commit();
      return { success: true };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new MapCategoryService();
