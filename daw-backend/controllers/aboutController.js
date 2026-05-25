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

    let formattedInfo = info.toJSON();
    formattedInfo.hasRejected = !!formattedInfo.hasRejected;

    const lang = req.query.lang || "en";
    if (lang === "en") {
      return res.status(200).json(formattedInfo);
    }

    // ─── LAZY TRANSLATION ───
    const Translation = require("../models/Translation");
    const { autoTranslate } = require("../services/openaiService");

    let spiritTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: "1", field: "spiritText", locale: "id" } });
    let missionTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: "1", field: "missionText", locale: "id" } });
    let visionTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: "1", field: "visionText", locale: "id" } });

    if (!spiritTrans || !missionTrans || !visionTrans) {
      console.log(`[Lazy Translation] Translating About Info...`);
      const freshSpirit = await autoTranslate(formattedInfo.spiritText, "Indonesian");
      const freshMission = await autoTranslate(formattedInfo.missionText, "Indonesian");
      const freshVision = await autoTranslate(formattedInfo.visionText, "Indonesian");

      const upsertAboutTrans = async (field, translatedText) => {
        if (!translatedText) return;
        const existing = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: "1", field, locale: "id" } });
        if (existing) await existing.update({ translatedText });
        else await Translation.create({ modelName: MODULE_NAME, recordId: "1", field, locale: "id", translatedText });
      };

      if (freshSpirit) { await upsertAboutTrans("spiritText", freshSpirit); formattedInfo.spiritText = freshSpirit; }
      if (freshMission) { await upsertAboutTrans("missionText", freshMission); formattedInfo.missionText = freshMission; }
      if (freshVision) { await upsertAboutTrans("visionText", freshVision); formattedInfo.visionText = freshVision; }
    } else {
      if (spiritTrans) formattedInfo.spiritText = spiritTrans.translatedText;
      if (missionTrans) formattedInfo.missionText = missionTrans.translatedText;
      if (visionTrans) formattedInfo.visionText = visionTrans.translatedText;
    }

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
