const Menu = require("../models/Menu");
const Page = require("../models/Page");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "MENU";
const NOTRANS_PREFIX = "NAV";
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// Anti-Loop Guard Helper
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

exports.getAllMenusFlat = async (req, res) => {
  try {
    const menus = await Menu.findAll({
      order: [["orderIndex", "ASC"]],
      include: [{ model: Page, attributes: ["title"] }],
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) > 0 
              FROM ApprovalDrafts 
              WHERE ApprovalDrafts.target_id = Menu.id COLLATE utf8mb4_unicode_ci 
              AND ApprovalDrafts.module_name = '${MODULE_NAME}' 
              AND ApprovalDrafts.status = 'Rejected'
            )`),
            "hasRejected",
          ],
        ],
      },
    });

    const formattedMenus = menus.map((menu) => {
      const m = menu.toJSON();
      m.hasRejected = !!m.hasRejected;
      return m;
    });

    res.status(200).json(formattedMenus);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch menus", error: error.message });
  }
};

exports.createMenu = async (req, res) => {
  const t = await sequelize.transaction();
  let newMenu = null;

  try {
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const userRole = req.userRole?.toLowerCase();
    let {
      label,
      parentId,
      type,
      pageId,
      externalLink,
      isActive,
      previous_notrans,
    } = req.body;

    if (type === "folder") {
      parentId = null;
      pageId = null;
      externalLink = null;
    }

    const lastMenu = await Menu.findOne({
      where: { parentId: parentId || null },
      order: [["orderIndex", "DESC"]],
      transaction: t,
    });
    const nextOrderIndex = lastMenu ? lastMenu.orderIndex + 1 : 0;

    const safePayload = {
      label: (label || "").trim(),
      parentId: parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
      orderIndex: nextOrderIndex,
    };

    const isEditor = userRole === "editor";

    newMenu = await Menu.create(
      { ...safePayload, is_locked: isEditor },
      { transaction: t },
    );

    if (isEditor) {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          {
            where: { notrans: previous_notrans, module_name: MODULE_NAME },
            transaction: t,
          },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(newMenu.id),
          action: "CREATE",
          payload: safePayload,
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await newMenu.update({ lock_ticket: notrans }, { transaction: t });
      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error(`🚨 [ERP] CREATE Menu ${notrans}:`, owlError.message);
      }

      return res.status(202).json({
        success: true,
        message: "Pengajuan menu dikirim.",
        ticket: notrans,
      });
    }

    // ADMIN FLOW
    await t.commit();
    res
      .status(201)
      .json({ success: true, message: "Menu berhasil dibuat!", menu: newMenu });
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
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const userRole = req.userRole?.toLowerCase();
    let {
      label,
      parentId,
      type,
      pageId,
      externalLink,
      isActive,
      previous_notrans,
    } = req.body;

    const menu = await Menu.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new Error("Menu tidak ditemukan");

    if (menu.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message: "Menu terkunci birokrasi.",
        ticket: menu.lock_ticket,
      });
    }

    if (parentId && parentId !== menu.parentId) {
      if (await isDescendant(id, parentId)) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "Struktur ilegal: Menu tidak bisa jadi anak sendiri.",
        });
      }
    }

    const safePayload = {
      label: (label || "").trim(),
      parentId: type === "folder" ? null : parentId || null,
      type,
      pageId: type === "page" ? pageId : null,
      externalLink: type === "external" ? externalLink : null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    };

    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);
      const ticketToClear = previous_notrans || menu.lock_ticket;

      if (ticketToClear) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          {
            where: { notrans: ticketToClear, module_name: MODULE_NAME },
            transaction: t,
          },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(id),
          action: "UPDATE",
          payload: safePayload,
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await menu.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );
      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (owlError) {
        console.error(`🚨 [ERP] UPDATE Menu ${notrans}:`, owlError.message);
      }
      return res.status(202).json({
        success: true,
        message: "Revisi menu dikirim.",
        ticket: notrans,
      });
    }

    // ADMIN FLOW
    await ApprovalDraft.update(
      { status: "Obsolete" },
      {
        where: {
          module_name: MODULE_NAME,
          target_id: String(id),
          status: ["Pending", "Rejected"],
        },
        transaction: t,
      },
    );
    await menu.update(
      { ...safePayload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );
    await t.commit();

    res
      .status(200)
      .json({ success: true, message: "Menu diperbarui secara live!" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({
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
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const userRole = req.userRole?.toLowerCase();

    const menu = await Menu.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!menu) throw new Error("Menu tidak ditemukan");

    if (menu.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message: "Menu terkunci.",
        ticket: menu.lock_ticket,
      });
    }

    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      await ApprovalDraft.update(
        { status: "Obsolete" },
        {
          where: {
            module_name: MODULE_NAME,
            target_id: String(id),
            status: ["Pending", "Rejected"],
          },
          transaction: t,
        },
      );

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(id),
          action: "DELETE",
          payload: { label: menu.label, type: menu.type },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await menu.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await Menu.update(
        { is_locked: true, lock_ticket: notrans },
        { where: { parentId: id }, transaction: t },
      );

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (e) {
        console.error(`🚨 [ERP] DELETE Menu ${notrans}:`, e.message);
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus menu dan sub-menunya dikirim.",
        ticket: notrans,
      });
    }

    // ADMIN FLOW
    await Menu.destroy({ where: { parentId: id }, transaction: t });
    await menu.destroy({ transaction: t });
    await t.commit();

    res
      .status(200)
      .json({ success: true, message: "Menu dan sub-menunya dihapus." });
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
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const userRole = req.userRole?.toLowerCase();
    const { updatedMenus, previous_notrans } = req.body;

    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          {
            where: { notrans: previous_notrans, module_name: MODULE_NAME },
            transaction: t,
          },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: "TREE",
          action: "UPDATE",
          payload: { updatedMenus },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      const menuIds = updatedMenus.map((m) => m.id);
      await Menu.update(
        { is_locked: true, lock_ticket: notrans },
        {
          where: { id: { [require("sequelize").Op.in]: menuIds } },
          transaction: t,
        },
      );

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: MODULE_NAME,
          karyawanId: req.karyawanId,
          token: req.headers["authorization"]?.split(" ")[1] || req.owl_token,
        });
      } catch (e) {
        console.error(`🚨 [ERP] REORDER Menu ${notrans}:`, e.message);
      }

      return res.status(202).json({
        success: true,
        message: "Perubahan struktur diajukan.",
        ticket: notrans,
      });
    }

    // ADMIN FLOW: Direct Bulk Execution
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

    await t.commit();
    res
      .status(200)
      .json({ success: true, message: "Struktur navigasi diperbarui live!" });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [REORDER ERROR]:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengatur ulang urutan.",
      error: error.message,
    });
  }
};
