const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;
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
      status,
    } = req.body;

    // Ambil data ID 1
    const info = await AboutInfo.findByPk(1);
    if (!info) return res.status(404).json({ message: "About info not found" });

    // IF locked
    if (info.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res
        .status(423)
        .json({
          message: "Data sedang ditinjau Admin.",
          ticket: info.lock_ticket,
        });
    }

    const packageContent = {
      spiritText: spiritText || info.spiritText,
      missionText: missionText || info.missionText,
      visionText: visionText || info.visionText,
      philosophyTitle: philosophyTitle || info.philosophyTitle,
      philosophyPillars: philosophyPillars || info.philosophyPillars, // Sequelize handle JSON otomatis
    };

    // Gatekeeper: Editor Flow
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: AboutInfo,
        targetId: 1, // Singleton selalu 1
        action: "UPDATE",
        payload: packageContent,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      return res
        .status(202)
        .json({
          message: "Revisi About Company dikirim.",
          ticket: result.notrans,
        });
    }
    // Superadmin Flow
    await info.update({
      ...packageContent,
      is_locked: false,
      lock_ticket: null,
    });
    res.status(200).json({ message: "About Info updated successfully!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
