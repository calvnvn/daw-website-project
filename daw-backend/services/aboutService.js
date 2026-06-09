const sequelize = require("../config/database");
const AboutInfo = require("../models/AboutInfo");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { autoTranslate } = require("./openaiService");
const ErpApprovalService = require("./erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");
const { saveManualTranslations } = require("../utils/translationHelper");
const { handleEditorStaging } = require("../utils/editorHelper");

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
    const safeTranslate = async (moduleName, id, field, sourceValue) => {
      let transRecord = await Translation.findOne({ where: { modelName: moduleName, recordId: String(id), field, locale: "id" } });
      if (!sourceValue || !String(sourceValue).trim()) {
        if (transRecord) await transRecord.destroy();
        return sourceValue;
      }
      if (!transRecord) {
        const fresh = await autoTranslate(sourceValue, "Indonesian");
        if (fresh) await Translation.create({ modelName: moduleName, recordId: String(id), field, locale: "id", translatedText: fresh });
        return fresh || sourceValue;
      }
      return transRecord.translatedText;
    };

    formattedInfo.spiritText = await safeTranslate(MODULE_NAME, "1", "spiritText", formattedInfo.spiritText);
    formattedInfo.missionText = await safeTranslate(MODULE_NAME, "1", "missionText", formattedInfo.missionText);
    formattedInfo.visionText = await safeTranslate(MODULE_NAME, "1", "visionText", formattedInfo.visionText);

    return formattedInfo;
  }

  /**
   * Conditionally update live data or stage approval drafts based on role.
   */
  async updateAboutInfo({ req, res, body, userRole, actorId, karyawanId, owlToken }) {
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

      // Populate translations if not provided (e.g. on partial updates)
      if (!body._translations) {
        const existingTrans = await Translation.findAll({
          where: {
            modelName: MODULE_NAME,
            recordId: "1",
          },
          transaction: t,
        });
        if (existingTrans.length > 0) {
          const transMap = { id: {} };
          existingTrans.forEach((t) => {
            if (t.locale === "id") {
              transMap.id[t.field] = t.translatedText;
            }
          });
          body._translations = transMap;
        }
      }

      const payload = this.processAboutPayload(body, info);

      if (normalizedRole === "editor" && status === "Published") {
        return handleEditorStaging({
          req, res, t,
          moduleName: MODULE_NAME,
          notransPrefix: NOTRANS_PREFIX,
          action: "UPDATE",
          targetId: "1",
          payload: { ...payload, status: "Published", _translations: body._translations },
          recordToLock: info,
          previousNotrans: previous_notrans,
          successMessage: "Revisi profil diajukan. Data dikunci menunggu persetujuan.",
        });
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
      await saveManualTranslations(MODULE_NAME, "1", body._translations, t);
      await t.commit();

      return { success: true, isDraft: false, message: "About Info updated live." };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new AboutService();
