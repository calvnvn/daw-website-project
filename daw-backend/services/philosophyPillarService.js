const sequelize = require("../config/database");
const PhilosophyPillar = require("../models/PhilosophyPillar");
const ApprovalDraft = require("../models/ApprovalDraft");
const Translation = require("../models/Translation");
const { saveManualTranslations } = require("../utils/translationHelper");
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

    const translatedPillars = [];
    for (let i = 0; i < formattedPillars.length; i++) {
      let item = formattedPillars[i];
      item.title = await safeTranslate(MODULE_NAME, item.id, "title", item.title);
      item.text = await safeTranslate(MODULE_NAME, item.id, "text", item.text);
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
            payload: { ...payload, status: "Published", _translations: body._translations },
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
      const newPlr = await PhilosophyPillar.create(
        { ...payload, is_locked: false },
        { transaction: t }
      );
      await saveManualTranslations(MODULE_NAME, String(newPlr.id), body._translations, t);
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
            payload: { ...payload, status: "Published", _translations: body._translations },
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
      await saveManualTranslations(MODULE_NAME, String(id), body._translations, t);
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
      await Translation.destroy({ where: { modelName: MODULE_NAME, recordId: String(id) }, transaction: t });
      await t.commit();

      return { success: true, isDraft: false };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }
}

module.exports = new PhilosophyPillarService();
