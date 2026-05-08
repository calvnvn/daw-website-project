const sequelize = require("../config/database");
const Philosophy = require("../models/Philosophy");
const ApprovalDraft = require("../models/ApprovalDraft");
const ErpApprovalService = require("../services/erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "Philosophy";
const NOTRANS_PREFIX = "PHL";

// Normalize incoming payload for the singleton philosophy record
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

// Retrieve singleton record with a rejection radar subquery
exports.getPhilosophy = async (req, res) => {
  try {
    const data = await Philosophy.findOne({
      where: { id: 1 },
      attributes: {
        include: [
          [
            // Collation Guard: Forces charset match to prevent DB cross-collation errors
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

// Orchestrate update logic (Editor staging vs Admin direct commit)
exports.updatePhilosophy = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase().trim();
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { status, previous_notrans } = req.body;

    // Acquire pessimistic row lock to prevent concurrent modification
    let info = await Philosophy.findByPk(1, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!info) info = await Philosophy.create({ id: 1 }, { transaction: t });

    // Guard: Prevent editors from overriding active approval processes
    if (info.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Philosophy sedang dikunci.",
        ticket: info.lock_ticket,
      });
    }

    const { payload } = await processPhilosophyPayload(req, info);

    // Flow 1: Editor initiates staging and ERP sync
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);
      const ticketToClear = previous_notrans || info.lock_ticket;

      // Invalidate replaced draft if resubmitting
      if (ticketToClear) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          {
            where: { notrans: ticketToClear, module_name: MODULE_NAME },
            transaction: t,
          },
        );
      }

      // Stage mutation payload
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

      // Lock live record
      await info.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );
      await t.commit();

      // Dispatch to external ERP engine
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

    // Flow 2: Admin overrides staging and performs direct live commit
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

    // Release locks and save live data
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
