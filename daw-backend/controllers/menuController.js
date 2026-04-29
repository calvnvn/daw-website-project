const Menu = require("../models/Menu");
const Page = require("../models/Page");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");

const MODULE_NAME = "MENU";

// HELPER: Anti-Loop Guard (Mencegah menu menjadi anak dari dirinya sendiri)
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

// HELPER: Selective Packing (Anti-Pollution Guard)
const packMenuPayload = (data) => {
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
};

// GET: Build Tree (Untuk Tampilan Website & Navigation Builder)
exports.getMenuTree = async (req, res) => {
  try {
    const menus = await Menu.findAll({
      where: { isActive: true },
      order: [["orderIndex", "ASC"]],
      include: [{ model: Page, attributes: ["slug"] }],
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
      .json({ message: "Gagal memuat struktur menu", error: error.message });
  }
};

// GET: Flat List (Sudah dibersihkan dari Radar Rejection)
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
      .json({ message: "Gagal memuat daftar menu", error: error.message });
  }
};

exports.createMenu = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const safePayload = packMenuPayload(req.body);

    const lastMenu = await Menu.findOne({
      where: { parentId: safePayload.parentId },
      order: [["orderIndex", "DESC"]],
      transaction: t,
    });
    safePayload.orderIndex = lastMenu ? lastMenu.orderIndex + 1 : 0;

    const newMenu = await Menu.create(safePayload, { transaction: t });

    await t.commit();
    res.status(201).json({
      success: true,
      message: "Menu berhasil ditambahkan secara live!",
      menu: newMenu,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({
      success: false,
      message: "Gagal membuat menu",
      error: error.message,
    });
  }
};

exports.updateMenu = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const menu = await Menu.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new Error("Menu tidak ditemukan");

    const safePayload = packMenuPayload(req.body);

    // Guard: Mencegah struktur menu melingkar (Circular Loop)
    if (safePayload.parentId && safePayload.parentId !== menu.parentId) {
      if (await isDescendant(id, safePayload.parentId)) {
        throw new Error(
          "Struktur ilegal: Menu tidak bisa ditaruh di bawah sub-menunya sendiri.",
        );
      }
    }

    // Ghost Cleanup: Bersihkan jika sebelumnya ada draf tertinggal dari sistem lama
    await ApprovalDraft.update(
      { status: "Obsolete" },
      {
        where: { module_name: MODULE_NAME, target_id: String(id) },
        transaction: t,
      },
    );

    await menu.update(safePayload, { transaction: t });
    await t.commit();

    res
      .status(200)
      .json({ success: true, message: "Menu diperbarui secara live!" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(error.message.includes("ilegal") ? 400 : 500).json({
      success: false,
      message: "Gagal memperbarui menu",
      error: error.message,
    });
  }
};

exports.deleteMenu = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const menu = await Menu.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new Error("Menu tidak ditemukan");

    // Hapus anak-anaknya juga secara rekursif (jika ada)
    await Menu.destroy({ where: { parentId: id }, transaction: t });
    await menu.destroy({ transaction: t });

    // Ghost Cleanup
    await ApprovalDraft.update(
      { status: "Obsolete" },
      {
        where: { module_name: MODULE_NAME, target_id: String(id) },
        transaction: t,
      },
    );

    await t.commit();
    res.status(200).json({
      success: true,
      message: "Menu beserta sub-menunya berhasil dihapus.",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({
      success: false,
      message: "Gagal menghapus menu",
      error: error.message,
    });
  }
};

exports.reorderMenus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { updatedMenus } = req.body;

    for (const item of updatedMenus) {
      if (item.parentId) {
        const circular = await isDescendant(item.id, item.parentId);
        if (circular)
          throw new Error(`Struktur melingkar pada menu ID: ${item.id}`);
      }

      await Menu.update(
        {
          orderIndex: item.orderIndex,
          parentId: item.parentId || null,
          is_locked: false, // Lepas gembok paksa (jika dulu sempat kekunci)
          lock_ticket: null,
        },
        { where: { id: item.id }, transaction: t },
      );
    }

    // Ghost Cleanup: Obsolete draf reorder lama (jika ada)
    await ApprovalDraft.update(
      { status: "Obsolete" },
      {
        where: { module_name: MODULE_NAME, target_id: "TREE" },
        transaction: t,
      },
    );

    await t.commit();
    res.status(200).json({
      success: true,
      message: "Struktur navigasi berhasil disimpan secara live!",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [REORDER ERROR]:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal menyimpan urutan navigasi",
      error: error.message,
    });
  }
};
