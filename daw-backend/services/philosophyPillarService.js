const sequelize = require("../config/database");
const PhilosophyPillar = require("../models/PhilosophyPillar");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { autoTranslate } = require("./openaiService");
const ErpApprovalService = require("./erpApprovalService");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "PhilosophyPillar";
const NOTRANS_PREFIX = "PLR";

class PhilosophyPillarService {
  /**
   * Helper to normalize incoming payload with default fallbacks
   */
  processPillarPayload(body) {
    const { iconId, title, text, orderIndex } = body;
    return {
      iconId: iconId || "human",
      title: title || "",
      text: text || "",
      orderIndex: parseInt(orderIndex, 10) || 1,
    };
  }

  /**
   * Fetch all pillars including dynamic rejection flags and translation
   */
  async getPillars(lang = "en") {
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

    if (lang === "en") return formattedPillars;

    // ─── LAZY TRANSLATION ───
    const translatedPillars = [];
    for (let i = 0; i < formattedPillars.length; i++) {
      let item = formattedPillars[i];
      
      let titleTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field: "title", locale: "id" } });
      let textTrans = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field: "text", locale: "id" } });
      
      const needsTitleTrans = item.title && !titleTrans;
      const needsTextTrans = item.text && !textTrans;

      if (needsTitleTrans || needsTextTrans) {
        console.log(`[Lazy Translation] Translating Philosophy Pillar: ${item.id}...`);
        const freshTitle = needsTitleTrans ? await autoTranslate(item.title, "Indonesian") : "";
        const freshText = needsTextTrans ? await autoTranslate(item.text, "Indonesian") : "";
        
        const upsertPillarTrans = async (field, translatedText) => {
          if (!translatedText) return;
          const existing = await Translation.findOne({ where: { modelName: MODULE_NAME, recordId: String(item.id), field, locale: "id" } });
          if (existing) await existing.update({ translatedText });
          else await Translation.create({ modelName: MODULE_NAME, recordId: String(item.id), field, locale: "id", translatedText });
        };

        if (freshTitle) { await upsertPillarTrans("title", freshTitle); item.title = freshTitle; }
        if (freshText) { await upsertPillarTrans("text", freshText); item.text = freshText; }
      } else {
        if (titleTrans) item.title = titleTrans.translatedText;
        if (textTrans) item.text = textTrans.translatedText;
      }
      translatedPillars.push(item);
    }

    return translatedPillars;
  }

  /**
   * Orchestrate new pillar creation (Editor staging vs Admin direct commit)
   */
  async createPillar({ body, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase().trim();
      const payload = this.processPillarPayload(body);

      // Editor Flow: Create locked placeholder and stage for ERP approval
      if (normalizedRole === "editor") {
        const notrans = await generateNotrans(NOTRANS_PREFIX);

        const newPillar = await PhilosophyPillar.create(
          { ...payload, is_locked: true, lock_ticket: notrans },
          { transaction: t }
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
          { transaction: t }
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

      // Admin Flow: Direct live commit
      await PhilosophyPillar.create(
        { ...payload, is_locked: false },
        { transaction: t }
      );
      await t.commit();

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  /**
   * Mutate existing pillar with pessimistic locking and role-based routing
   */
  async updatePillar({ id, body, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase().trim();
      const { previous_notrans } = body;

      const pillar = await PhilosophyPillar.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!pillar) throw new Error("NOT_FOUND: Pilar Filosofi tidak ditemukan.");

      if (pillar.is_locked && normalizedRole === "editor") {
        throw new Error(`LOCKED: tiket ${pillar.lock_ticket}`);
      }

      const payload = this.processPillarPayload(body);

      if (normalizedRole === "editor") {
        const notrans = await generateNotrans(NOTRANS_PREFIX);
        const ticketToClear = previous_notrans || pillar.lock_ticket;

        if (ticketToClear) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            {
              where: { notrans: ticketToClear, module_name: MODULE_NAME },
              transaction: t,
            }
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
          { transaction: t }
        );

        await pillar.update(
          { is_locked: true, lock_ticket: notrans },
          { transaction: t }
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

      await ApprovalDraft.update(
        { status: "Obsolete" },
        {
          where: {
            module_name: MODULE_NAME,
            target_id: String(id),
            status: ["Pending", "Rejected"],
          },
          transaction: t,
        }
      );
      await pillar.update(
        { ...payload, is_locked: false, lock_ticket: null },
        { transaction: t }
      );
      await t.commit();

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  /**
   * Safely remove pillar via ERP staging or direct database purge
   */
  async deletePillar({ id, userRole, actorId, karyawanId, owlToken }) {
    const t = await sequelize.transaction();
    try {
      const normalizedRole = userRole?.toLowerCase().trim();
      
      const pillar = await PhilosophyPillar.findByPk(id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!pillar) throw new Error("NOT_FOUND: Pilar Filosofi tidak ditemukan.");

      if (pillar.is_locked && normalizedRole === "editor") {
        throw new Error(`LOCKED: tiket ${pillar.lock_ticket}`);
      }

      if (normalizedRole === "editor") {
        const notrans = await generateNotrans(NOTRANS_PREFIX);
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
          { transaction: t }
        );

        await pillar.update(
          { is_locked: true, lock_ticket: notrans },
          { transaction: t }
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

      await ApprovalDraft.update(
        { status: "Obsolete" },
        {
          where: {
            module_name: MODULE_NAME,
            target_id: String(id),
            status: ["Pending", "Rejected"],
          },
          transaction: t,
        }
      );
      await pillar.destroy({ transaction: t });
      await t.commit();

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new PhilosophyPillarService();
