const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");

// 🔴 Asumsi sementara untuk kode approval CMS.
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE || "040101";
// GET: Data Info & Philosophu
exports.getAboutInfo = async (req, res) => {
  try {
    const [info] = await sequelize.query(
      "SELECT * FROM AboutInfo WHERE id = 1 LIMIT 1",
      { type: sequelize.QueryTypes.SELECT },
    );

    if (!info) {
      return res.status(404).json({ message: "About info not found" });
    }
    if (typeof info.philosophyPillars === "string") {
      info.philosophyPillars = JSON.parse(info.philosophyPillars);
    }

    res.status(200).json(info);
  } catch (error) {
    console.error("Error GET About Info:", error);
    res.status(500).json({ message: "Failed to fetch about info" });
  }
};

// PUT: Data Info & Philosophy
exports.updateAboutInfo = async (req, res) => {
  try {
    const {
      spiritText,
      missionText,
      visionText,
      philosophyTitle,
      philosophyPillars,
    } = req.body;

    // Gatekeeper: Editor Flow
    if (req.userRole && req.userRole.toLowerCase() === "editor") {
      const packageContent = {
        spiritText: spiritText || "",
        missionText: missionText || "",
        visionText: visionText || "",
        philosophyTitle: philosophyTitle || "",
        philosophyPillars: philosophyPillars || [], // Kirim sebagai Array asli
      };

      const tokenOWL = req.headers["authorization"]?.split(" ")[1];

      await ErpApprovalService.createDraft(
        {
          jenisApproval: JENIS_APP_CMS,
          karyawanid: req.userId,
          module: "AboutInfo",
          action: "UPDATE",
          targetId: "1", // Hardcode 1 karena About single row
          content: packageContent,
        },
        tokenOWL,
      );

      return res.status(202).json({
        message: "Draf revisi About Company berhasil dikirim ke antrean.",
      });
    }

    // Supderadmin Flow (Langsung execute)
    const updateQuery = `
      UPDATE AboutInfo 
      SET 
        spiritText = :spiritText,
        missionText = :missionText,
        visionText = :visionText,
        philosophyTitle = :philosophyTitle,
        philosophyPillars = :philosophyPillars,
        updatedAt = NOW()
      WHERE id = 1
    `;

    await sequelize.query(updateQuery, {
      replacements: {
        spiritText: spiritText || "",
        missionText: missionText || "",
        visionText: visionText || "",
        philosophyTitle: philosophyTitle || "",
        philosophyPillars: JSON.stringify(philosophyPillars || []),
      },
      type: sequelize.QueryTypes.UPDATE,
    });

    res.status(200).json({ message: "About Info updated successfully!" });
  } catch (error) {
    console.error("Error UPDATE About Info:", error);
    res.status(500).json({ message: "Failed to update about info" });
  }
};
