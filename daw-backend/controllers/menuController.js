const Menu = require("../models/Menu");
const Page = require("../models/Page");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");
const Translation = require("../models/Translation");
const { autoTranslate } = require("../services/openaiService");

const MODULE_NAME = "MENU";

/**
 * HELPER FUNCTIONS
 */
// Anti-Loop Guard: Mencegah menu dijadikan anak dari sub-menunya sendiri (Circular Reference).
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

// Payload Sanitizer: Membersihkan data tidak relevan berdasarkan 'type' menu.
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

/**
 * CONTROLLERS (Strictly Admin / Direct Live Mode)
 */

// GET (Public/UI): Format data menjadi hirarki/Tree untuk navigasi website.
exports.getMenuTree = async (req, res) => {
  try {
    const menus = await Menu.findAll({
      where: { isActive: true },
      order: [["orderIndex", "ASC"]],
      include: [{ model: Page, attributes: ["slug"] }],
    });

    const lang = req.query.lang || "en";
    const formattedMenus = menus.map((m) => m.toJSON());

    if (lang !== "en") {
      for (let i = 0; i < formattedMenus.length; i++) {
        let m = formattedMenus[i];
        let labelTrans = await Translation.findOne({
          where: {
            modelName: MODULE_NAME,
            recordId: String(m.id),
            field: "label",
            locale: "id",
          },
        });
        const needsLabelTrans = m.label && !labelTrans;

        if (needsLabelTrans) {
          console.log(`[Lazy Translation] Translating Menu Label: ${m.id}...`);
          const freshLabel = needsLabelTrans
            ? await autoTranslate(m.label, "Indonesian")
            : "";
          if (freshLabel) {
            const existing = await Translation.findOne({
              where: {
                modelName: MODULE_NAME,
                recordId: String(m.id),
                field: "label",
                locale: "id",
              },
            });
            if (existing) await existing.update({ translatedText: freshLabel });
            else
              await Translation.create({
                modelName: MODULE_NAME,
                recordId: String(m.id),
                field: "label",
                locale: "id",
                translatedText: freshLabel,
              });
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

// GET (Admin): Format data list/flat untuk tabel manajemen CMS.
exports.getAllMenusFlat = async (req, res) => {
  try {
    const menus = await Menu.findAll({
      order: [["orderIndex", "ASC"]],
      include: [{ model: Page, attributes: ["title"] }],
    });

    const lang = req.query.lang || "en";
    const formattedMenus = menus.map((m) => m.toJSON());

    if (lang !== "en") {
      for (let i = 0; i < formattedMenus.length; i++) {
        let m = formattedMenus[i];
        let labelTrans = await Translation.findOne({
          where: {
            modelName: MODULE_NAME,
            recordId: String(m.id),
            field: "label",
            locale: "id",
          },
        });
        const needsLabelTrans = m.label && !labelTrans;

        if (needsLabelTrans) {
          console.log(`[Lazy Translation] Translating Menu Label: ${m.id}...`);
          const freshLabel = needsLabelTrans
            ? await autoTranslate(m.label, "Indonesian")
            : "";
          if (freshLabel) {
            const existing = await Translation.findOne({
              where: {
                modelName: MODULE_NAME,
                recordId: String(m.id),
                field: "label",
                locale: "id",
              },
            });
            if (existing) await existing.update({ translatedText: freshLabel });
            else
              await Translation.create({
                modelName: MODULE_NAME,
                recordId: String(m.id),
                field: "label",
                locale: "id",
                translatedText: freshLabel,
              });
            m.label = freshLabel;
          }
        } else {
          if (labelTrans) m.label = labelTrans.translatedText;
        }
      }
    }

    res.status(200).json(formattedMenus);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal memuat daftar menu", error: error.message });
  }
};

// CREATE (Admin): Eksekusi langsung. Otomatis menaruh menu di urutan (orderIndex) paling bawah.
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

// UPDATE (Admin): Eksekusi langsung dengan perlindungan Anti-Loop.
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

    // Guard: Blokir pemindahan parent jika menyebabkan Loop/Error silsilah
    if (safePayload.parentId && safePayload.parentId !== menu.parentId) {
      if (await isDescendant(id, safePayload.parentId)) {
        throw new Error(
          "Struktur ilegal: Menu tidak bisa ditaruh di bawah sub-menunya sendiri.",
        );
      }
    }

    // Ghost Cleanup: Hapus sisa draft lama untuk menjaga konsistensi DB
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

// DELETE (Admin): Eksekusi langsung. Menghapus menu beserta seluruh anaknya (Recursive Destroy).
exports.deleteMenu = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const menu = await Menu.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new Error("Menu tidak ditemukan");

    // Cascading Delete: Hapus anak sebelum menghapus induk
    await Menu.destroy({ where: { parentId: id }, transaction: t });
    await menu.destroy({ transaction: t });

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

// BULK UPDATE (Admin): Validasi dan simpan ulang struktur menu (Drag & Drop UI Handler).
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
          is_locked: false,
          lock_ticket: null,
        },
        { where: { id: item.id }, transaction: t },
      );
    }

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
