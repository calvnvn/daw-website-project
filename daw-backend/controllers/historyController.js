const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");

// 🔴 Asumsi sementara untuk kode approval CMS.
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE || "040101";

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
    const { histories } = req.body;

    // Gatekeeper: Editor Flow
    if (req.userRole && req.userRole.toLowerCase() === "editor") {
      // Bungkusan untuk History cukup keseluruhan Array-nya saja
      const packageContent = {
        histories: histories || [],
      };

      const tokenOWL = req.headers["authorization"]?.split(" ")[1];

      await ErpApprovalService.createDraft(
        {
          jenisApproval: JENIS_APP_CMS,
          karyawanid: req.userId,
          module: "History",
          action: "BULK_UPDATE",
          targetId: "ALL",
          content: packageContent,
        },
        tokenOWL,
      );

      return res.status(202).json({
        message: "Draf Timeline Perusahaan berhasil dikirim ke antrean.",
      });
    }

    // Supderadmin Flow (Langsung Execute)
    await sequelize.query("DELETE FROM Histories");

    if (histories && histories.length > 0) {
      for (const item of histories) {
        await sequelize.query(
          "INSERT INTO Histories (year, description) VALUES (:year, :desc)",
          {
            replacements: {
              year: item.year || "",
              desc: item.text || "",
            },
            type: sequelize.QueryTypes.INSERT,
          },
        );
      }
    }

    res.status(200).json({ message: "Company timeline updated successfully!" });
  } catch (error) {
    console.error("Error updating histories:", error);
    res.status(500).json({ message: "Failed to update histories" });
  }
};
