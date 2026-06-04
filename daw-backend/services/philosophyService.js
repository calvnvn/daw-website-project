const sequelize = require("../config/database");
const Philosophy = require("../models/Philosophy");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { autoTranslate } = require("./openaiService");
const ErpApprovalService = require("./erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "Philosophy";
const NOTRANS_PREFIX = "PHL";

class PhilosophyService {
  /**
   * Helper to structure and sanitize the payload with default fallbacks.
   */
  sanitizePayload(input, existing = {}) {
    return {
      philosophyTitle: (input.philosophyTitle !== undefined ? input.philosophyTitle : existing.philosophyTitle) || "",
    };
  }

  /**
   * Retrieves singleton Philosophy record with status checks and lazy translation.
   * @param {string} lang - Selected locale language (e.g. 'en', 'id')
   * @returns {Object} Translated and processed Philosophy payload
   */
  async getPhilosophy(lang = "en") {
    const data = await Philosophy.findOne({
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

    if (!data) {
      throw new Error("NOT_FOUND: Philosophy data not found");
    }

    let formatted = data.toJSON();
    formatted.hasRejected = !!formatted.hasRejected;

    if (lang === "en") return formatted;

    // ─── LAZY TRANSLATION PIPELINE ───
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

    formatted.philosophyTitle = await safeTranslate(MODULE_NAME, "1", "philosophyTitle", formatted.philosophyTitle);

    return formatted;
  }

  /**
   * Updates Philosophy or stages a revision request depending on the requester's role.
   */
  async updatePhilosophy({ body, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase().trim();
      const { status, previous_notrans } = body;

      // Acquire pessimistic row lock to prevent concurrent modification
      let info = await Philosophy.findByPk(1, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      
      if (!info) {
        info = await Philosophy.create({ id: 1 }, { transaction: t });
      }

      // Guard: Prevent editors from overriding active approval processes
      if (info.is_locked && normalizedRole === "editor") {
        throw new Error(`LOCKED: tiket ${info.lock_ticket}`);
      }

      const payload = this.sanitizePayload(body, info);

      // Flow 1: Editor initiates staging and ERP sync
      if (normalizedRole === "editor" && status === "Published") {
        const notrans = await generateNotrans(NOTRANS_PREFIX);
        const ticketToClear = previous_notrans || info.lock_ticket;

        // Invalidate replaced draft if resubmitting
        if (ticketToClear) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            {
              where: { notrans: ticketToClear, module_name: MODULE_NAME },
              transaction: t,
            }
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
          { transaction: t }
        );

        // Lock live record
        await info.update(
          { is_locked: true, lock_ticket: notrans },
          { transaction: t }
        );
        
        await t.commit();

        // Dispatch to external ERP engine
        try {
          await ErpApprovalService.initiateApproval({
            notrans,
            moduleName: MODULE_NAME,
            karyawanId: karyawanId,
            token: owlToken,
          });
        } catch (e) {
          console.error("🚨 ERP Sync Fail:", e.message);
        }

        return { success: true, isDraft: true, ticket: notrans };
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
        }
      );

      // Release locks and save live data
      await info.update(
        { ...payload, is_locked: false, lock_ticket: null },
        { transaction: t }
      );
      await Translation.destroy({ where: { modelName: MODULE_NAME, recordId: "1" }, transaction: t });
      
      await t.commit();

      return { success: true, isDraft: false, message: "Philosophy updated live." };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new PhilosophyService();
