const sequelize = require("../config/database");
const Philosophy = require("../models/Philosophy");
const ApprovalDraft = require("../models/ApprovalDraft");
const ErpApprovalService = require("../services/erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "Philosophy";
const NOTRANS_PREFIX = "PHL";

const processPhilosophyPayload = async (req, existingData = {}) => {
  const { philosophyTitle } = req.body;
  return {
    payload: {
      philosophyTitle:
        (philosophyTitle !== undefined
          ? philosophyTitle
          : existingData.philosophyTitle) || "",
    },
  };
};

exports.getPhilosophy = async (req, res) => {
  try {
    const data = await Philosophy.findOne({
      where: { id: 1 },
      attributes: {
        include: [
          [
            // 🛡️ Blueprint 2.C: Collation Guard ditambahkan
            sequelize.literal(`(
              SELECT COUNT(*) > 0 
              FROM ApprovalDrafts 
              WHERE target_id = '1' COLLATE utf8mb4_unicode_ci 
              AND module_name = '${MODULE_NAME}' 
              AND status = 'Rejected'
            )`),
            "hasRejected",
          ],
        ],
      },
    });

    if (!data)
      return res.status(404).json({ message: "Philosophy data not found" });

    const formatted = data.toJSON();
    formatted.hasRejected = !!formatted.hasRejected;
    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePhilosophy = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase().trim();
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { status, previous_notrans } = req.body;

    let info = await Philosophy.findByPk(1, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!info) info = await Philosophy.create({ id: 1 }, { transaction: t });

    if (info.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Philosophy sedang dikunci.",
        ticket: info.lock_ticket,
      });
    }

    const { payload } = await processPhilosophyPayload(req, info);

    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);
      const ticketToClear = previous_notrans || info.lock_ticket;

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
          target_id: "1",
          action: "UPDATE",
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await info.update(
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

      return res.status(202).json({ success: true, ticket: notrans });
    }

    // ADMIN PATH
    await ApprovalDraft.update(
      { status: "Obsolete" },
      {
        where: {
          module_name: MODULE_NAME,
          target_id: "1",
          status: ["Pending", "Rejected"],
        },
        transaction: t,
      },
    );
    await info.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );
    await t.commit();

    res
      .status(200)
      .json({ success: true, message: "Philosophy updated live." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};
