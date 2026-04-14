const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
const History = require("../models/History");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// GET
exports.getHistories = async (req, res) => {
  try {
    const histories = await sequelize.query(
      "SELECT * FROM Histories ORDER BY year ASC",
      { type: sequelize.QueryTypes.SELECT },
    );
    res.status(200).json(histories);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch histories" });
    console.log(error);
  }
};

// PUT
exports.updateHistories = async (req, res) => {
  try {
    const { histories, status } = req.body; 

    // Gatekeeper: Editor Flow
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      
      const result = await ErpApprovalService.initiateApproval({
        model: History,
        targetId: "ALL", 
        action: "BULK_UPDATE",
        payload: { histories }, 
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });

      return res.status(202).json({
        message: "Draf Timeline Perusahaan berhasil dikirim ke antrean OWL.",
        ticket: result.notrans
      });
    }

    // Supderadmin Flow (Langsung Execute)
    const t = await sequelize.transaction();
    try {
      await History.destroy({ where: {}, transaction: t });

      if (histories && histories.length > 0) {
        const historyData = histories.map(item => ({
          year: item.year,
          description: item.text, 
          is_locked: false,
          lock_ticket: null
        }));
        await History.bulkCreate(historyData, { transaction: t });
      }

      await t.commit();
      res.status(200).json({ message: "Company timeline updated successfully!" });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to update histories", error: error.message });
  }
};