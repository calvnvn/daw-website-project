const Menu = require("../models/Menu");
const Page = require("../models/Page");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");
const { ErpApprovalService } = require("../services/erpApprovalService");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

const isDescendant = async (menuId, targetParentId) => {
  if (!targetParentId) return false;
  if (menuId === targetParentId) return true;

  let current = await Menu.findByPk(targetParentId);
  while (current && current.parentId) {
    if (current.parentId === menuId) return true;
    current = await Menu.findByPk(current.parentId);
  }
  return false;
};
exports.getMenuTree = async (req, res) => {
  try {
    const menus = await Menu.findAll({
      where: { isActive: true },
      order: [["orderIndex", "ASC"]],
      include: [
        {
          model: Page,
          attributes: ["slug"],
        },
      ],
    });

    const menuMap = {};
    const tree = [];

    menus.forEach((menu) => {
      menuMap[menu.id] = { ...menu.toJSON(), children: [] };
    });

    menus.forEach((menu) => {
      if (menu.parentId) {
        if (menuMap[menu.parentId]) {
          menuMap[menu.parentId].children.push(menuMap[menu.id]);
        }
      } else {
        tree.push(menuMap[menu.id]);
      }
    });

    res.status(200).json(tree);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to build menu tree", error: error.message });
  }
};

// ADMIN MENU MANAGEMENT (CRUD & Reorder)
exports.getAllMenusFlat = async (req, res) => {
  try {
    const menus = await Menu.findAll({
      order: [["orderIndex", "ASC"]],
      include: [{ model: Page, attributes: ["title"] }],
    });
    res.status(200).json(menus);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch menus", error: error.message });
  }
};

exports.createMenu = async (req, res) => {
  try {
    let { label, parentId, type, pageId, externalLink, isActive } = req.body;

    if (type === "folder") {
      parentId = null;
      pageId = null;
      externalLink = null;
    }

    const lastMenu = await Menu.findOne({
      where: { parentId: parentId || null },
      order: [["orderIndex", "DESC"]],
    });
    const nextOrderIndex = lastMenu ? lastMenu.orderIndex + 1 : 0;

    const newMenu = await Menu.create({
      label,
      parentId: parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive,
      orderIndex: nextOrderIndex,
      is_locked: false,
      lock_ticket: null,
    });

    res.status(201).json({ message: "Menu berhasil dibuat!", menu: newMenu });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal membuat menu", error: error.message });
  }
};

exports.updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    let { label, parentId, type, pageId, externalLink, isActive } = req.body;

    const menu = await Menu.findByPk(id);
    if (!menu) return res.status(404).json({ message: "Menu tidak ditemukan" });

    // Anti-Loop Guard
    if (parentId && parentId !== menu.parentId) {
      if (await isDescendant(id, parentId)) {
        return res.status(400).json({
          message: "Struktur ilegal: Menu tidak bisa jadi anak sendiri.",
        });
      }
    }

    await menu.update({
      label,
      parentId: type === "folder" ? null : parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive,
      is_locked: false,
      lock_ticket: null,
    });

    res.status(200).json({ message: "Menu berhasil diperbarui!" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal memperbarui menu", error: error.message });
  }
};

exports.deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await Menu.findByPk(id);
    if (!menu) return res.status(404).json({ message: "Menu tidak ditemukan" });

    // Hapus anak-anaknya juga secara rekursif agar tidak ada data yatim piatu
    await Menu.destroy({ where: { parentId: id } });
    await menu.destroy();

    res.status(200).json({
      message: "Menu dan sub-menunya berhasil dihapus secara permanen.",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal menghapus menu", error: error.message });
  }
};

// Endpoint Khusus untuk menangkap hasil Drag & Drop
exports.reorderMenus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { updatedMenus } = req.body;

    for (const item of updatedMenus) {
      // Validasi struktur (Bypass check jika parentId null/root)
      if (item.parentId) {
        const circular = await isDescendant(item.id, item.parentId);
        if (circular)
          throw new Error(
            `Struktur melingkar terdeteksi pada menu ID: ${item.id}`,
          );
      }

      await Menu.update(
        {
          orderIndex: item.orderIndex,
          parentId: item.parentId || null,
          is_locked: false,
          lock_ticket: null,
        },
        { where: { id: item.id }, transaction: t },
      );
    }

    await t.commit();
    res.status(200).json({
      message: "Struktur navigasi berhasil diperbarui secara instan!",
    });
  } catch (error) {
    if (t) await t.rollback(); // 🛡️ Rollback jika ada satu saja yang gagal
    console.error("🚨 [REORDER ERROR]:", error.message);
    res
      .status(500)
      .json({ message: "Gagal mengatur ulang urutan.", error: error.message });
  }
};
