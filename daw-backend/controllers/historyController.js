const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
const History = require("../models/History");
const ApprovalDraft = require("../models/ApprovalDraft");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { generateNotrans } = require("../utils/notransGenerator");

const MODULE_NAME = "History";
const NOTRANS_PREFIX = "HIS";
const TARGET_ID = "ALL_TIMELINE";

const processHistoryPayload = (req) => {
  const { histories } = req.body;

  if (!Array.isArray(histories)) return { histories: [] };

  const cleanHistories = histories.map((item) => ({
    year: String(item.year || "").trim(),
    description: (item.text || item.description || "").trim(),
  }));

  return { histories: cleanHistories };
};

exports.getHistories = async (req, res) => {
  try {
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

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ message: "Gagal memuat timeline sejarah." });
  }
};

exports.updateHistories = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const actorId = String(req.owl_username || req.karyawanId || "")
      .trim()
      .toLowerCase();
    const userRole = req.userRole?.toLowerCase().trim();
    const { status } = req.body;

    const lockedRow = await History.findOne({
      where: { is_locked: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (lockedRow && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Timeline sedang dikunci oleh proses approval aktif.",
        ticket: lockedRow.lock_ticket,
      });
    }

    const payload = processHistoryPayload(req);

    // JALUR 1: EDITOR (Birokrasi / Baton Pass)
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans(NOTRANS_PREFIX);

      await invalidateOldDrafts(TARGET_ID, MODULE_NAME, t);

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
        { transaction: t },
      );

      await History.update(
        { is_locked: true, lock_ticket: notrans },
        { where: {}, transaction: t },
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
        console.error(
          `[SYNC WARNING] Ticket ${notrans} registered locally but ERP sync failed.`,
        );
      }

      return res.status(202).json({ success: true, ticket: notrans });
    }

    // ADMIN (Direct Commit / Bypass)
    await ApprovalDraft.update(
      { status: "Obsolete" },
      {
        where: {
          module_name: MODULE_NAME,
          target_id: TARGET_ID,
          status: ["Pending", "Rejected"],
        },
        transaction: t,
      },
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
    return res
      .status(200)
      .json({ success: true, message: "Timeline diperbarui secara live." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    res.status(500).json({ message: error.message });
  }
};
