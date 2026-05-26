const sequelize = require("../config/database");
const Menu = require("../models/Menu");
const Page = require("../models/Page");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { autoTranslate } = require("./openaiService");

const MODULE_NAME = "MENU";

class MenuService {
  async isDescendant(menuId, targetParentId) {
    if (!targetParentId) return false;
    if (menuId === targetParentId) return true;

    let current = await Menu.findByPk(targetParentId);
    while (current && current.parentId) {
      if (current.parentId === menuId) return true;
      current = await Menu.findByPk(current.parentId);
    }
    return false;
  }

  packMenuPayload(data) {
    let { label, parentId, type, pageId, externalLink, isActive } = data;
    if (type === "folder") {
      parentId = null;
      pageId = null;
      externalLink = null;
    }
    return {
      label: (label || "").trim(),
      parentId: parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
      is_locked: false,
      lock_ticket: null,
    };
  }

  async getMenuTree(lang = "en") {
    const menus = await Menu.findAll({
      where: { isActive: true },
      order: [["orderIndex", "ASC"]],
      include: [{ model: Page, attributes: ["slug"] }],
    });

    const formattedMenus = menus.map((m) => m.toJSON());

    if (lang !== "en") {
      for (let i = 0; i < formattedMenus.length; i++) {
        let m = formattedMenus[i];
        let labelTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(m.id), field: "label", locale: "id" } });
        
        if (m.label && !labelTrans) {
          const freshLabel = await autoTranslate(m.label, "Indonesian");
          if (freshLabel) {
            const existing = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(m.id), field: "label", locale: "id" } });
            if (existing) await existing.update({ translatedText: freshLabel });
            else await Translation.create({ modelName: MODULE_NAME, recordId: String(m.id), field: "label", locale: "id", translatedText: freshLabel });
            m.label = freshLabel;
          }
        } else {
          if (labelTrans) m.label = labelTrans.translatedText;
        }
      }
    }

    const menuMap = {};
    const tree = [];

    formattedMenus.forEach((menu) => {
      menuMap[menu.id] = { ...menu, children: [] };
    });

    formattedMenus.forEach((menu) => {
      if (menu.parentId) {
        if (menuMap[menu.parentId]) menuMap[menu.parentId].children.push(menuMap[menu.id]);
      } else {
        tree.push(menuMap[menu.id]);
      }
    });

    return tree;
  }

  async getAllMenusFlat(lang = "en") {
    const menus = await Menu.findAll({
      order: [["orderIndex", "ASC"]],
      include: [{ model: Page, attributes: ["title"] }],
    });

    const formattedMenus = menus.map((m) => m.toJSON());

    if (lang !== "en") {
      for (let i = 0; i < formattedMenus.length; i++) {
        let m = formattedMenus[i];
        let labelTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(m.id), field: "label", locale: "id" } });
        
        if (m.label && !labelTrans) {
          const freshLabel = await autoTranslate(m.label, "Indonesian");
          if (freshLabel) {
            const existing = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(m.id), field: "label", locale: "id" } });
            if (existing) await existing.update({ translatedText: freshLabel });
            else await Translation.create({ modelName: MODULE_NAME, recordId: String(m.id), field: "label", locale: "id", translatedText: freshLabel });
            m.label = freshLabel;
          }
        } else {
          if (labelTrans) m.label = labelTrans.translatedText;
        }
      }
    }

    return formattedMenus;
  }

  async createMenu(body) {
    const t = await sequelize.transaction();
    try {
      const safePayload = this.packMenuPayload(body);
      const lastMenu = await Menu.findOne({ where: { parentId: safePayload.parentId }, order: [["orderIndex", "DESC"]], transaction: t });
      safePayload.orderIndex = lastMenu ? lastMenu.orderIndex + 1 : 0;
      
      const newMenu = await Menu.create(safePayload, { transaction: t });
      await t.commit();
      
      return newMenu;
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async updateMenu(id, body) {
    const t = await sequelize.transaction();
    try {
      const menu = await Menu.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!menu) {
        await t.rollback();
        throw new Error("NOT_FOUND: Menu tidak ditemukan");
      }

      const safePayload = this.packMenuPayload(body);

      if (safePayload.parentId && safePayload.parentId !== menu.parentId) {
        if (await this.isDescendant(id, safePayload.parentId)) {
          await t.rollback();
          throw new Error("VALIDATION_ERROR: Struktur ilegal: Menu tidak bisa ditaruh di bawah sub-menunya sendiri.");
        }
      }

      await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, target_id: String(id) }, transaction: t });
      await menu.update(safePayload, { transaction: t });
      await t.commit();
      
      return { success: true };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async deleteMenu(id) {
    const t = await sequelize.transaction();
    try {
      const menu = await Menu.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!menu) {
        await t.rollback();
        throw new Error("NOT_FOUND: Menu tidak ditemukan");
      }

      await Menu.destroy({ where: { parentId: id }, transaction: t });
      await menu.destroy({ transaction: t });

      await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, target_id: String(id) }, transaction: t });
      await t.commit();

      return { success: true };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async reorderMenus(updatedMenus) {
    const t = await sequelize.transaction();
    try {
      for (const item of updatedMenus) {
        if (item.parentId) {
          const circular = await this.isDescendant(item.id, item.parentId);
          if (circular) {
            await t.rollback();
            throw new Error(`VALIDATION_ERROR: Struktur melingkar pada menu ID: ${item.id}`);
          }
        }

        await Menu.update({ orderIndex: item.orderIndex, parentId: item.parentId || null, is_locked: false, lock_ticket: null }, { where: { id: item.id }, transaction: t });
      }

      await ApprovalDraft.update({ status: "Obsolete" }, { where: { module_name: MODULE_NAME, target_id: "TREE" }, transaction: t });
      await t.commit();
      
      return { success: true };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new MenuService();
