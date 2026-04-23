const sequelize = require("../config/database");
const { ErpApprovalService } = require("../services/erpApprovalService");
const History = require("../models/History");
const ApprovalDraft = require("../models/ApprovalDraft");
const { invalidateOldDrafts } = require("../utils/draftCleanup");

// Memastikan mapping data dari frontend aman sebelum masuk transaksi.
const processHistoryPayload = async (req) => {
  const { histories } = req.body;

  const cleanHistories = Array.isArray(histories)
    ? histories.map((item) => ({
        year: item.year,
        description: item.text || item.description || "",
      }))
    : [];

  return {
    payload: { histories: cleanHistories },
    filesToDelete: [],
  };
};

// GET: Fetch all history milestones
exports.getHistories = async (req, res) => {
  try {
    const histories = await History.findAll({
      attributes: ["id", "year", "description", "is_locked", "lock_ticket"],
      order: [["year", "ASC"]],
    });
    res.status(200).json(histories);
  } catch (error) {
    console.error("🚨 [GET HISTORY ERROR]:", error.message);
    res
      .status(500)
      .json({ message: "Gagal mengambil data sejarah perusahaan." });
  }
};

// MAIN FUNCTION: Bulk Update Timeline
exports.updateHistories = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase().trim();
    const { status, previous_notrans } = req.body;

    // Memakai t.LOCK.UPDATE agar 2 Editor tidak bentrok saat mengeklik bersamaan
    const lockedMilestone = await History.findOne({
      where: { is_locked: true },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (lockedMilestone && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Timeline sedang dalam peninjauan OWL dan tidak dapat diubah.",
        ticket: lockedMilestone.lock_ticket,
      });
    }

    // B. PROCESSING: Jalankan Helper
    const { payload } = await processHistoryPayload(req);

    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        moduleName: "History",
        model: History,
        targetId: "ALL_TIMELINE",
        action: "BULK_UPDATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await History.update(
        { is_locked: true, lock_ticket: result.notrans },
        { where: {}, transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Draf revisi timeline berhasil diajukan ke ERP OWL.",
        ticket: result.notrans,
      });
    }

    // JALUR 2: SUPERADMIN / ADMIN (Direct Execution)
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts("History", "ALL_TIMELINE", t);
    }

    await History.destroy({ where: {}, transaction: t });

    if (payload.histories.length > 0) {
      const historyData = payload.histories.map((item) => ({
        year: item.year,
        description: item.description,
        is_locked: false,
        lock_ticket: null,
      }));
      await History.bulkCreate(historyData, { transaction: t });
    }

    await t.commit();
    res.status(200).json({
      message: "Timeline perusahaan berhasil diperbarui secara permanen!",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [UPDATE HISTORY ERROR]:", error.message);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan sistem.", error: error.message });
  }
};
