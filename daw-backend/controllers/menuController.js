const Menu = require("../models/Menu");
const Page = require("../models/Page");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");

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
    let {
      label,
      parentId,
      type,
      pageId,
      externalLink,
      isActive,
      status,
      previous_notrans,
    } = req.body;
    const userRole = req.userRole?.toLowerCase();

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

    const menuData = {
      label,
      parentId: parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive,
      orderIndex: nextOrderIndex,
      is_locked: false,
      lock_ticket: null,
    };

    // Fast Local Commit
    const t = await sequelize.transaction();
    try {
      newMenu = await Menu.create(menuData, { transaction: t });
      await t.commit();
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }

    // Editor Gate
    if (userRole === "editor" && status === "Published") {
      try {
        if (previous_notrans) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            { where: { notrans: previous_notrans } },
          );
        }

        const result = await ErpApprovalService.initiateApproval({
          model: Menu,
          targetId: newMenu.id,
          action: "CREATE",
          payload: menuData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        await newMenu.update({ is_locked: true, lock_ticket: result.notrans });
        return res.status(202).json({
          message: "Permintaan buat menu baru dikirim ke OWL.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        // Orphan Guard
        console.error(`🚨 [CLEANUP] Menghapus orphan menu ID: ${newMenu.id}`);
        await newMenu.destroy();
        throw owlError;
      }
    }

    // Superadmin Flow
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
    let {
      label,
      parentId,
      type,
      pageId,
      externalLink,
      isActive,
      status,
      previous_notrans,
    } = req.body;
    const userRole = req.userRole?.toLowerCase();

    const menu = await Menu.findByPk(id);
    if (!menu) return res.status(404).json({ message: "Menu not found" });

    // Check Lock
    if (menu.is_locked && userRole === "editor") {
      return res.status(423).json({
        message: "Menu ini sedang dikunci oleh proses approval.",
        ticket: menu.lock_ticket,
      });
    }

    const updatedData = {
      label,
      parentId: type === "folder" ? null : parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive,
    };

    // Editor Gate
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: Menu,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      await menu.update({ is_locked: true, lock_ticket: result.notrans });
      return res.status(202).json({
        message: "Revisi menu dikirim.",
        ticket: result.notrans,
      });
    }

    // Superadmin Flow
    await menu.update({ ...updatedData, is_locked: false, lock_ticket: null });
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
    const userRole = req.userRole?.toLowerCase();

    const menu = await Menu.findByPk(id);
    if (!menu) return res.status(404).json({ message: "Menu not found" });

    if (menu.is_locked && userRole === "editor") {
      return res.status(423).json({
        message: "Menu sedang dikunci oleh proses approval.",
        ticket: menu.lock_ticket,
      });
    }

    // Editor Gate
    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: Menu,
        targetId: id,
        action: "DELETE",
        payload: { label: menu.label },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      await menu.update({ is_locked: true, lock_ticket: result.notrans });
      return res.status(202).json({
        message: "Permintaan hapus menu dikirim ke OWL.",
        ticket: result.notrans,
      });
    }

    // Superadmin Flow
    await menu.destroy();
    res.status(200).json({ message: "Menu deleted permanently" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete menu", error: error.message });
  }
};

// Endpoint Khusus untuk menangkap hasil Drag & Drop
exports.reorderMenus = async (req, res) => {
  try {
    const { updatedMenus, previous_notrans } = req.body;
    const userRole = req.userRole?.toLowerCase();

    // Global Race Condition Check
    const lockedMenu = await Menu.findOne({ where: { is_locked: true } });
    if (lockedMenu && userRole === "editor") {
      return res.status(423).json({
        message:
          "Struktur navigasi tidak dapat diubah karena ada pengajuan menu yang sedang diperiksa Admin.",
        ticket: lockedMenu.lock_ticket,
      });
    }

    // --- JALUR EDITOR: BULK REORDER REQUEST ---
    if (userRole === "editor") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: Menu,
        targetId: "ALL_TREE",
        action: "BULK_REORDER",
        payload: { updatedMenus },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      // 🔒 LOCK ALL_TREE: Kunci seluruh tabel Menu agar tidak ada yang bisa edit/delete
      await Menu.update(
        { is_locked: true, lock_ticket: result.notrans },
        { where: {} },
      );

      return res.status(202).json({
        message:
          "Perubahan urutan menu dikirim ke OWL. Seluruh Navigasi dikunci sementara.",
        ticket: result.notrans,
      });
    }

    // Superadmin Flow
    const t = await sequelize.transaction();
    try {
      for (const item of updatedMenus) {
        const circular = await isDescendant(item.id, item.parentId);
        if (circular)
          throw new Error(
            `Menu ${item.id} tidak boleh menjadi anak dari dirinya sendiri.`,
          );

        await Menu.update(
          {
            orderIndex: item.orderIndex,
            parentId: item.parentId,
            is_locked: false,
            lock_ticket: null,
          },
          { where: { id: item.id }, transaction: t },
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
