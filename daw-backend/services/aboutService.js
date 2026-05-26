const sequelize = require("../config/database");
const AboutInfo = require("../models/AboutInfo");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { autoTranslate } = require("./openaiService");
const ErpApprovalService = require("./erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "AboutInfo";
const NOTRANS_PREFIX = "ABT";

class AboutService {
  /**
   * Standardize the request payload with database values as fallback.
   */
  processAboutPayload(body, existingData = {}) {
    const { spiritText, missionText, visionText } = body;
    return {
      spiritText: (spiritText !== undefined ? spiritText : existingData.spiritText) || "",
      missionText: (missionText !== undefined ? missionText : existingData.missionText) || "",
      visionText: (visionText !== undefined ? visionText : existingData.visionText) || "",
    };
  }

  /**
   * Retrieve singleton AboutInfo with rejection checks and lazy translation.
   * @param {string} lang - The locale of the client request
   * @returns {Object} Sanitized AboutInfo payload
   */
  async getAboutInfo(lang = "en") {
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

    if (!info) {
      throw new Error("NOT_FOUND: About info not found.");
    }

    let formattedInfo = info.toJSON();
    formattedInfo.hasRejected = !!formattedInfo.hasRejected;

    if (lang === "en") {
      return formattedInfo;
    }

    // Lazy Translation Pipeline
    let spiritTrans = await Translation.findOne({
      where: { modelName: MODULE_NAME, recordId: "1", field: "spiritText", locale: "id" },
    });
    let missionTrans = await Translation.findOne({
      where: { modelName: MODULE_NAME, recordId: "1", field: "missionText", locale: "id" },
    });
    let visionTrans = await Translation.findOne({
      where: { modelName: MODULE_NAME, recordId: "1", field: "visionText", locale: "id" },
    });

    const needsSpiritTrans = formattedInfo.spiritText && !spiritTrans;
    const needsMissionTrans = formattedInfo.missionText && !missionTrans;
    const needsVisionTrans = formattedInfo.visionText && !visionTrans;

    if (needsSpiritTrans || needsMissionTrans || needsVisionTrans) {
      // console.log(`[Lazy Translation] Translating About Info...`);
      const freshSpirit = needsSpiritTrans
        ? await autoTranslate(formattedInfo.spiritText, "Indonesian")
        : "";
      const freshMission = needsMissionTrans
        ? await autoTranslate(formattedInfo.missionText, "Indonesian")
        : "";
      const freshVision = needsVisionTrans
        ? await autoTranslate(formattedInfo.visionText, "Indonesian")
        : "";

      const upsertAboutTrans = async (field, translatedText) => {
        if (!translatedText) return;
        const existing = await Translation.findOne({
          where: { modelName: MODULE_NAME, recordId: "1", field, locale: "id" },
        });
        if (existing) await existing.update({ translatedText });
        else
          await Translation.create({
            modelName: MODULE_NAME,
            recordId: "1",
            field,
            locale: "id",
            translatedText,
          });
      };

      if (freshSpirit) {
        await upsertAboutTrans("spiritText", freshSpirit);
        formattedInfo.spiritText = freshSpirit;
      }
      if (freshMission) {
        await upsertAboutTrans("missionText", freshMission);
        formattedInfo.missionText = freshMission;
      }
      if (freshVision) {
        await upsertAboutTrans("visionText", freshVision);
        formattedInfo.visionText = freshVision;
      }
    } else {
      if (spiritTrans) formattedInfo.spiritText = spiritTrans.translatedText;
      if (missionTrans) formattedInfo.missionText = missionTrans.translatedText;
      if (visionTrans) formattedInfo.visionText = visionTrans.translatedText;
    }

    return formattedInfo;
  }

  /**
   * Conditionally update live data or stage approval drafts based on role.
   */
  async updateAboutInfo({ body, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase().trim();
      const { status, previous_notrans } = body;

      let info = await AboutInfo.findByPk(1, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!info) {
        info = await AboutInfo.create({ id: 1 }, { transaction: t });
      }

      if (info.is_locked && normalizedRole === "editor") {
        throw new Error(`LOCKED: tiket ${info.lock_ticket}`);
      }

      const payload = this.processAboutPayload(body, info);

      if (normalizedRole === "editor" && status === "Published") {
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
            karyawanId: karyawanId,
            token: owlToken,
          });
        } catch (e) {
          console.error("ERP Sync Fail:", e.message);
        }

        return { success: true, isDraft: true, ticket: notrans };
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

      return { success: true, isDraft: false, message: "About Info updated live." };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new AboutService();
