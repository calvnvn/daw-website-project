const Menu = require("../models/Menu");
const Page = require("../models/Page");
const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE || "040101";

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
          attributes: ["slug"], // Kita butuh slug untuk membuat URL otomatis di frontend
        },
      ],
    });

    // 2. Hash Map Logic (Mengubah Flat Array jadi Nested Tree dalam O(n) Time)
    const menuMap = {};
    const tree = [];

    // Buat kerangka dasar dengan array 'children' kosong
    menus.forEach((menu) => {
      menuMap[menu.id] = { ...menu.toJSON(), children: [] };
    });

    // Rangkai pohonnya
    menus.forEach((menu) => {
      if (menu.parentId) {
        // Jika dia punya Parent, dorong dia ke dalam array 'children' milik Parent-nya
        if (menuMap[menu.parentId]) {
          menuMap[menu.parentId].children.push(menuMap[menu.id]);
        }
      } else {
        // Jika tidak punya Parent, dia adalah Akar (Root Menu Utama)
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

// ==========================================
// ADMIN MENU MANAGEMENT (CRUD & Reorder)
// ==========================================

// Ambil semua menu dalam bentuk flat (Untuk tabel di Admin)
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
      parentId = null; // Paksa jadi root menu
      pageId = null; // Bersihkan data sampah
      externalLink = null; // Bersihkan data sampah
    }

    // Auto hitung orderIndex (taruh di paling bawah)
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
    });

    res.status(201).json({ message: "Menu created", menu: newMenu });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create menu", error: error.message });
  }
};

exports.updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    let { label, parentId, type, pageId, externalLink, isActive } = req.body;

    const menu = await Menu.findByPk(id);
    if (!menu) return res.status(404).json({ message: "Menu not found" });

    if (type === "folder") {
      parentId = null;
      pageId = null;
      externalLink = null;
    }

    // Gatekeeper: Editor Flow
    if (req.userRole && req.userRole.toLowerCase() === "editor") {
      const packageContent = {
        label,
        parentId: parentId || null,
        type,
        pageId: type === "page" ? pageId : null,
        externalLink: type === "external" ? externalLink : null,
        isActive,
      };

      await ErpApprovalService.createDraft(
        {
          jenisApproval: JENIS_APP_CMS,
          karyawanid: req.userId,
          module: "Menu",
          action: "UPDATE",
          targetId: id,
          content: packageContent,
        },
        req.headers["authorization"]?.split(" ")[1],
      );

      return res
        .status(202)
        .json({ message: "Perubahan menu dikirim ke Admin DAW." });
    }

    // Admin Flow
    await menu.update({
      label,
      parentId: parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive,
    });
    res.status(200).json({ message: "Menu updated" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update menu", error: error.message });
  }
};

exports.deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await Menu.findByPk(id);
    if (!menu) return res.status(404).json({ message: "Menu not found" });

    await menu.destroy(); // Jika punya children, otomatis ikut terhapus karena CASCADE di model
    res.status(200).json({ message: "Menu deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete menu", error: error.message });
  }
};

// Endpoint Khusus untuk menangkap hasil Drag & Drop
exports.reorderMenus = async (req, res) => {
  const { updatedMenus } = req.body;

  // Gatekeeper: Editor (Bulk Reorder)
  if (req.userRole && req.userRole.toLowerCase() === "editor") {
    await ErpApprovalService.createDraft(
      {
        jenisApproval: JENIS_APP_CMS,
        karyawanid: req.userId,
        module: "Menu",
        action: "BULK_REORDER",
        targetId: "ALL_TREE",
        content: { updatedMenus }, // Kirim seluruh array hasil drag & drop
      },
      req.headers["authorization"]?.split(" ")[1],
    );

    return res
      .status(202)
      .json({ message: "Urutan menu baru menunggu persetujuan Admin." });
  }

  // Admin Flow
  const t = await sequelize.transaction();
  try {
    for (const item of updatedMenus) {
      const circular = await isDescendant(item.id, item.parentId);
      if (circular) {
        throw new Error(
          `Integritas data terlanggar: Menu ID ${item.id} tidak boleh menjadi anak dari keturunannya sendiri.`,
        );
      }
      await Menu.update(
        { orderIndex: item.orderIndex, parentId: item.parentId },
        { where: { id: item.id }, transaction: t },
      );
    }
    await t.commit();
    res.status(200).json({ message: "Menus reordered successfully!" });
  } catch (error) {
    await t.rollback();
    res
      .status(500)
      .json({ message: "Failed to reorder menus", error: error.message });
  }
};
