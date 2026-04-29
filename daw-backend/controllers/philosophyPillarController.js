const sequelize = require("../config/database");
const PhilosophyPillar = require("../models/PhilosophyPillar");
const ApprovalDraft = require("../models/ApprovalDraft");
const ErpApprovalService = require("../services/erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "PhilosophyPillar";
const NOTRANS_PREFIX = "PLR";

const processPillarPayload = (req) => {
  const { iconId, title, text, orderIndex } = req.body;
  return {
    iconId: iconId || "human",
    title: title || "",
    text: text || "",
    orderIndex: parseInt(orderIndex, 10) || 1,
  };
};

// 1. GET ALL (Dengan Rejection Radar O(1))
exports.getPillars = async (req, res) => {
  try {
    const pillars = await PhilosophyPillar.findAll({
      order: [["orderIndex", "ASC"]],
      attributes: {
        include: [
          [
            // 🛡️ Collation Guard untuk mencegah Error 500
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

// 2. CREATE NEW PILLAR (Baton Pass)
exports.createPillar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase().trim();
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();

    const payload = processPillarPayload(req);

    // JALUR EDITOR (Drafting)
    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      // Simpan "Placeholder" di tabel utama sebagai jangkar penguncian
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

      await t.commit(); // LOCAL COMMIT SEBELUM ERP HANDSHAKE

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

    // JALUR ADMIN (Direct Commit)
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

// ==========================================
// 3. UPDATE PILLAR (Item-Level Lock)
// ==========================================
exports.updatePillar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase().trim();
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { previous_notrans } = req.body;

    // 🛡️ Row-Level Lock
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

    // JALUR EDITOR (Drafting & Ghost Cleanup)
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

    // JALUR ADMIN (Direct Commit)
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

// 4. DELETE PILLAR (Baton Pass Delete)
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

    // JALUR EDITOR (Draft DELETE)
    if (userRole === "editor") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      // Payload minimalis untuk delete
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

    // JALUR ADMIN (Hard Delete)
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
