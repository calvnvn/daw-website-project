const sequelize = require("../config/database");
const PhilosophyPillar = require("../models/PhilosophyPillar");
const ApprovalDraft = require("../models/ApprovalDraft");
const ErpApprovalService = require("../services/erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "PhilosophyPillar";
const NOTRANS_PREFIX = "PLR";

// Normalize incoming payload with default fallbacks
const processPillarPayload = (req) => {
  const { iconId, title, text, orderIndex } = req.body;
  return {
    iconId: iconId || "human",
    title: title || "",
    text: text || "",
    orderIndex: parseInt(orderIndex, 10) || 1,
  };
};

// Fetch all pillars including dynamic rejection flags via subquery
exports.getPillars = async (req, res) => {
  try {
    const pillars = await PhilosophyPillar.findAll({
      order: [["orderIndex", "ASC"]],
      attributes: {
        include: [
          [
            // Collation Guard: Forces charset match to prevent database cross-collation 500 errors
            sequelize.literal(`(
              SELECT COUNT(*) > 0 
              FROM ApprovalDrafts 
              WHERE ApprovalDrafts.target_id COLLATE utf8mb4_unicode_ci = CAST(PhilosophyPillar.id AS CHAR) 
              AND ApprovalDrafts.module_name = '${MODULE_NAME}' 
              AND ApprovalDrafts.status = 'Rejected'
            )`),
            "hasRejected",
          ],
        ],
      },
    });

    const formattedPillars = pillars.map((p) => {
      const item = p.toJSON();
      item.hasRejected = !!item.hasRejected;
      return item;
    });

    res.status(200).json({ success: true, data: formattedPillars });
  } catch (error) {
    console.error("🚨 [GET PILLARS ERROR]:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Gagal memuat Pilar Filosofi" });
  }
};

// Orchestrate new pillar creation (Editor staging vs Admin direct commit)
exports.createPillar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase().trim();
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();

    const payload = processPillarPayload(req);

    // Editor Flow: Create locked placeholder and stage for ERP approval
    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      const newPillar = await PhilosophyPillar.create(
        { ...payload, is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(newPillar.id),
          action: "CREATE",
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
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
      } catch (e) {
        console.error("ERP Sync Fail:", e.message);
      }

      return res.status(202).json({
        success: true,
        message: "Pengajuan Pilar baru dikirim.",
        ticket: notrans,
      });
    }

    // Admin Flow: Direct live commit
    await PhilosophyPillar.create(
      { ...payload, is_locked: false },
      { transaction: t },
    );
    await t.commit();

    res
      .status(201)
      .json({ success: true, message: "Pilar baru berhasil ditambahkan." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [CREATE PILLAR ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mutate existing pillar with pessimistic locking and role-based routing
exports.updatePillar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase().trim();
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { previous_notrans } = req.body;

    // Acquire row-level lock to prevent concurrent modifications
    const pillar = await PhilosophyPillar.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!pillar) throw new Error("Pilar Filosofi tidak ditemukan.");

    if (pillar.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Pilar ini sedang dikunci oleh proses approval.",
        ticket: pillar.lock_ticket,
      });
    }

    const payload = processPillarPayload(req);

    // Editor Flow: Stage updates and sync with ERP
    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);
      const ticketToClear = previous_notrans || pillar.lock_ticket;

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
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await pillar.update(
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
      } catch (e) {
        console.error("ERP Sync Fail:", e.message);
      }

      return res.status(202).json({
        success: true,
        message: "Revisi pilar diajukan.",
        ticket: notrans,
      });
    }

    // Admin Flow: Purge old drafts and execute direct update
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
    await pillar.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );
    await t.commit();

    res
      .status(200)
      .json({ success: true, message: "Pilar berhasil diperbarui." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

// Safely remove pillar via ERP staging or direct database purge
exports.deletePillar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase().trim();
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();

    const pillar = await PhilosophyPillar.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!pillar) throw new Error("Pilar Filosofi tidak ditemukan.");

    if (pillar.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Pilar ini sedang dikunci (mungkin dalam proses hapus).",
        ticket: pillar.lock_ticket,
      });
    }

    // Editor Flow: Stage deletion intent and lock live record
    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      // Minimal payload for DELETE action
      const payload = { title: pillar.title, iconId: pillar.iconId };

      await ApprovalDraft.create(
        {
          notrans,
          module_name: MODULE_NAME,
          target_id: String(id),
          action: "DELETE",
          payload,
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await pillar.update(
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
      } catch (e) {
        console.error("ERP Sync Fail:", e.message);
      }

      return res.status(202).json({
        success: true,
        message: "Pengajuan hapus pilar dikirim.",
        ticket: notrans,
      });
    }

    // Admin Flow: Hard delete and invalidate related drafts
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
    await pillar.destroy({ transaction: t });
    await t.commit();

    res.status(200).json({ success: true, message: "Pilar berhasil dihapus." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};
