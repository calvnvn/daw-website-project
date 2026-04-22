const sequelize = require("../config/database");
const { ErpApprovalService } = require("../services/erpApprovalService");
const History = require("../models/History");
const ApprovalDraft = require("../models/ApprovalDraft");

const getRole = (req) =>
  req.userRole ? req.userRole.toLowerCase().trim() : "";
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

// PUT: Bulk Update Timeline (The Bulk Architect Flow)
exports.updateHistories = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const { histories, status, previous_notrans } = req.body;

    const lockedMilestone = await History.findOne({
      where: { is_locked: true },
      transaction: t,
    });

    if (lockedMilestone && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Timeline sedang dalam peninjauan dan tidak dapat diubah.",
        ticket: lockedMilestone.lock_ticket,
      });
    }

    // --- JALUR EDITOR: REQUEST APPROVAL ---
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: History,
        targetId: "ALL",
        action: "BULK_UPDATE",
        payload: { histories },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      await History.update(
        { is_locked: true, lock_ticket: result.notrans },
        { where: {}, transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Draf revisi timeline berhasil dikirim.",
        ticket: result.notrans,
      });
    }

    // --- JALUR SUPERADMIN: DIRECT EXECUTION ---
    await History.destroy({ where: {}, transaction: t });

    if (histories && Array.isArray(histories)) {
      const historyData = histories.map((item) => ({
        year: item.year,
        description: item.text,
        is_locked: false,
        lock_ticket: null,
      }));
      await History.bulkCreate(historyData, { transaction: t });
    }

    await t.commit();
    res
      .status(200)
      .json({ message: "Timeline perusahaan berhasil diperbarui langsung!" });
  } catch (error) {
    if (t) await t.rollback();
    console.error("🚨 [UPDATE HISTORY ERROR]:", error.message);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan sistem.", error: error.message });
  }
};
