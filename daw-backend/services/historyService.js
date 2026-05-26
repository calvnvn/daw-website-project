const sequelize = require("../config/database");
const ErpApprovalService = require("./erpApprovalService");
const History = require("../models/History");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { autoTranslate } = require("./openaiService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "History";
const NOTRANS_PREFIX = "HIS";
const TARGET_ID = "ALL_TIMELINE"; // Treat entire timeline as single entity

class HistoryService {
  /**
   * Normalize and sanitize history array
   */
  processHistoryPayload(body) {
    const { histories } = body;

    if (!Array.isArray(histories)) return { histories: [] };

    const cleanHistories = histories.map((item) => ({
      year: String(item.year || "").trim(),
      description: (item.text || item.description || "").trim(),
    }));

    return { histories: cleanHistories };
  }

  /**
   * Fetch timeline data with rejection flags and lazy translation
   */
  async getHistories(lang = "en") {
    const histories = await History.findAll({
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*) > 0 
              FROM ApprovalDrafts 
              WHERE target_id = '${TARGET_ID}' COLLATE utf8mb4_unicode_ci 
              AND module_name = '${MODULE_NAME}' 
              AND status = 'Rejected'
            )`),
            "hasRejected",
          ],
        ],
      },
      order: [["year", "ASC"]],
    });

    const formatted = histories.map((h) => {
      const item = h.toJSON();
      item.hasRejected = !!item.hasRejected;
      return item;
    });

    if (lang === "en") return formatted;

    // ─── LAZY TRANSLATION ───
    const translatedHistories = [];
    for (let i = 0; i < formatted.length; i++) {
      let item = formatted[i];
      let descTrans = await Translation.findOne({ 
        where: { modelName: MODULE_NAME, recordId: String(item.id), field: "description", locale: "id" } 
      });
      
      if (!descTrans) {
        console.log(`[Lazy Translation] Translating History Timeline: ${item.year}...`);
        const freshDesc = await autoTranslate(item.description, "Indonesian");
        
        if (freshDesc) {
           await Translation.create({ 
             modelName: MODULE_NAME, recordId: String(item.id), field: "description", locale: "id", translatedText: freshDesc 
           });
           item.description = freshDesc;
        }
      } else {
        item.description = descTrans.translatedText;
      }
      translatedHistories.push(item);
    }

    return translatedHistories;
  }

  /**
   * Orchestrate timeline updates (Editor Staging vs Admin Direct)
   */
  async updateHistories({ body, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase().trim();
      const { status } = body;

      const lockedRow = await History.findOne({
        where: { is_locked: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (lockedRow && normalizedRole === "editor") {
        throw new Error(`LOCKED: tiket ${lockedRow.lock_ticket}`);
      }

      const payload = this.processHistoryPayload(body);

      // Flow 1: Editor (Stage draft & Sync ERP)
      if (normalizedRole === "editor" && status === "Published") {
        const notrans = await generateNotrans(NOTRANS_PREFIX);

        await invalidateOldDrafts(TARGET_ID, MODULE_NAME, t); // Note: parameters in original were (TARGET_ID, MODULE_NAME, t)

        await ApprovalDraft.create(
          {
            notrans,
            module_name: MODULE_NAME,
            target_id: TARGET_ID,
            action: "UPDATE",
            payload,
            created_by: actorId,
            status: "Pending",
          },
          { transaction: t }
        );

        await History.update(
          { is_locked: true, lock_ticket: notrans },
          { where: {}, transaction: t }
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
          console.error(`🚨 [SYNC WARNING] Ticket ${notrans} registered locally but ERP sync failed:`, e.message);
        }

        return { success: true, isDraft: true, ticket: notrans };
      }

      // Flow 2: Admin (Direct overwrite)
      await ApprovalDraft.update(
        { status: "Obsolete" },
        {
          where: {
            module_name: MODULE_NAME,
            target_id: TARGET_ID,
            status: ["Pending", "Rejected"],
          },
          transaction: t,
        }
      );
      
      await History.destroy({ where: {}, transaction: t });

      if (payload.histories.length > 0) {
        const historyData = payload.histories.map((h) => ({
          ...h,
          is_locked: false,
          lock_ticket: null,
        }));
        await History.bulkCreate(historyData, { transaction: t });
      }

      await t.commit();
      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new HistoryService();
