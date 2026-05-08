const sequelize = require("../config/database");
const AboutInfo = require("../models/AboutInfo");
const ApprovalDraft = require("../models/ApprovalDraft");
const ErpApprovalService = require("../services/erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "AboutInfo";
const NOTRANS_PREFIX = "ABT";

// Map incoming request body to a standardized payload structure with fallback to existing state
const processAboutPayload = async (req, existingData = {}) => {
  const { spiritText, missionText, visionText } = req.body;
  return {
    payload: {
      spiritText:
        (spiritText !== undefined ? spiritText : existingData.spiritText) || "",
      missionText:
        (missionText !== undefined ? missionText : existingData.missionText) ||
        "",
      visionText:
        (visionText !== undefined ? visionText : existingData.visionText) || "",
    },
  };
};

// Retrieve singleton entity and dynamically inject rejection status via correlated subquery
exports.getAboutInfo = async (req, res) => {
  try {
    const info = await AboutInfo.findOne({
      where: { id: 1 },
      attributes: {
        include: [
          [
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

    if (!info) return res.status(404).json({ message: "About info not found" });

    const formattedInfo = info.toJSON();
    formattedInfo.hasRejected = !!formattedInfo.hasRejected;

    res.status(200).json(formattedInfo);
  } catch (error) {
    console.error("🚨 [GET ABOUT ERROR]:", error.message);
    res.status(500).json({ message: "Failed to fetch about info" });
  }
};

// Orchestrate conditional mutation logic enforcing Role-Based Access Control and transaction staging
exports.updateAboutInfo = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase().trim();
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const { status, previous_notrans } = req.body;

    let info = await AboutInfo.findByPk(1, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!info) info = await AboutInfo.create({ id: 1 }, { transaction: t });

    if (info.is_locked && userRole === "editor") {
      await t.rollback();
      return res
        .status(423)
        .json({ message: "Data sedang dikunci.", ticket: info.lock_ticket });
    }

    const { payload } = await processAboutPayload(req, info);

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
      .json({ success: true, message: "About Info updated live." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};
