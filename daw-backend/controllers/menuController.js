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
          attributes: ["slug"], 
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
    let { label, parentId, type, pageId, externalLink, isActive, status } = req.body;

    if (type === "folder") {
      parentId = null; 
      pageId = null; 
      externalLink = null; 
    }

    // Auto hitung orderIndex (taruh di paling bawah)
    const lastMenu = await Menu.findOne({
      where: { parentId: parentId || null },
      order: [["orderIndex", "DESC"]],
    });
    const nextOrderIndex = lastMenu ? lastMenu.orderIndex + 1 : 0;

    const menuData = {
      label,
      parentId: parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive,
      orderIndex: nextOrderIndex,
    };

    // Editor Flow
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.headers["authorization"]?.split(" ")[1];
      const result = await ErpApprovalService.initiateApproval({
        model: Menu,
        targetId: null, // Data baru belum ada ID
        action: "CREATE",
        payload: menuData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({ message: "Permintaan buat menu baru dikirim ke OWL.", ticket: result.notrans });
    }

    // Superadmin Flow
    const newMenu = await Menu.create(menuData);
    res.status(201).json({ message: "Menu created", menu: newMenu });
  } catch (error) {
    res.status(500).json({ message: "Failed to create menu", error: error.message });
  }
};

exports.updateMenu = async (req, res) => {
  try {
    const { id } = req.params;
    let { label, parentId, type, pageId, externalLink, isActive, status } = req.body;

    const menu = await Menu.findByPk(id);
    if (!menu) return res.status(404).json({ message: "Menu not found" });

    if (menu.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({ message: "Menu ini sedang dikunci oleh proses approval.", ticket: menu.lock_ticket });
    }

    const updatedData = {
      label,
      parentId: type === "folder" ? null : (parentId || null),
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive,
    };

    // Editor Flow
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.headers["authorization"]?.split(" ")[1];
      const result = await ErpApprovalService.initiateApproval({
        model: Menu,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });
      return res.status(202).json({ message: "Revisi menu dikirim ke OWL.", ticket: result.notrans });
    }

    // Superadmin Flow
    await menu.update({ ...updatedData, is_locked: false, lock_ticket: null });
    res.status(200).json({ message: "Menu updated" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update menu", error: error.message });
  }
};

exports.deleteMenu = async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await Menu.findByPk(id);
    if (!menu) return res.status(404).json({ message: "Menu not found" });

    // Editor Flow
    if (req.userRole?.toLowerCase() === "editor") {
      const tokenOWL = req.headers["authorization"]?.split(" ")[1];
      const result = await ErpApprovalService.initiateApproval({
        model: Menu,
        targetId: id,
        action: "DELETE",
        payload: { label: menu.label }, 
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });
      return res.status(202).json({ message: "Permintaan hapus menu dikirim ke OWL. Menu dikunci.", ticket: result.notrans });
    }

    // Superadmin Flow
    await menu.destroy(); 
    res.status(200).json({ message: "Menu deleted permanently" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete menu", error: error.message });
  }
};

// Endpoint Khusus untuk menangkap hasil Drag & Drop
exports.reorderMenus = async (req, res) => {
  try {
    const { updatedMenus } = req.body; // Array berisi {id, parentId, orderIndex}

    // --- JALUR EDITOR: BULK REORDER REQUEST ---
    if (req.userRole?.toLowerCase() === "editor") {
      const tokenOWL = req.headers["authorization"]?.split(" ")[1];
      
      const result = await ErpApprovalService.initiateApproval({
        model: Menu,
        targetId: "ALL_TREE", 
        action: "BULK_REORDER",
        payload: { updatedMenus },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({ 
        message: "Perubahan urutan menu (Drag & Drop) dikirim ke antrean OWL.", 
        ticket: result.notrans 
      });
    }

    // Superadmin Flow
    const t = await sequelize.transaction();
    try {
      for (const item of updatedMenus) {
        const circular = await isDescendant(item.id, item.parentId);
        if (circular) throw new Error(`Menu ${item.id} tidak boleh menjadi anak dari dirinya sendiri.`);

        await Menu.update(
          { orderIndex: item.orderIndex, parentId: item.parentId, is_locked: false, lock_ticket: null },
          { where: { id: item.id }, transaction: t }
        );
      }
      await t.commit();
      res.status(200).json({ message: "Menus reordered successfully!" });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ message: "Reorder failed", error: error.message });
  }
};