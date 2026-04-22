const sequelize = require("../config/database");
const AboutInfo = require("../models/AboutInfo");
const ApprovalDraft = require("../models/ApprovalDraft");
const { ErpApprovalService } = require("../services/erpApprovalService");

// Helper untuk Role
const getRole = (req) =>
  req.userRole ? req.userRole.toLowerCase().trim() : "";

// GET: Data Info & Philosophy
exports.getAboutInfo = async (req, res) => {
  try {
    const info = await AboutInfo.findByPk(1, {
      attributes: [
        "spiritText",
        "missionText",
        "visionText",
        "philosophyTitle",
        "philosophyPillars",
        "is_locked",
        "lock_ticket",
      ],
    });

    if (!info) return res.status(404).json({ message: "About info not found" });

    res.status(200).json(info);
  } catch (error) {
    console.error("Error GET About Info:", error);
    res.status(500).json({ message: "Failed to fetch about info" });
  }
};

// PUT: Data Info & Philosophy (Singleton Approval Flow)
exports.updateAboutInfo = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = getRole(req);
    const {
      spiritText,
      missionText,
      visionText,
      philosophyTitle,
      philosophyPillars,
      status,
      previous_notrans,
    } = req.body;

    const info = await AboutInfo.findByPk(1, { transaction: t });
    if (!info) {
      await t.rollback();
      return res.status(404).json({ message: "About info not found" });
    }

    // 1. Pre-Flight Check: Lock Guard
    if (info.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message:
          "Data sedang ditinjau Admin. Perubahan saat ini tidak diizinkan.",
        ticket: info.lock_ticket,
      });
    }

    const packageContent = {
      spiritText: spiritText || info.spiritText,
      missionText: missionText || info.missionText,
      visionText: visionText || info.visionText,
      philosophyTitle: philosophyTitle || info.philosophyTitle,
      philosophyPillars: philosophyPillars || info.philosophyPillars,
    };

    // --- JALUR EDITOR: TWO-PHASE EXECUTION ---
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: AboutInfo,
        targetId: 1, // Singleton ID
        action: "UPDATE",
        payload: packageContent,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      // C. Set Local Lock
      await info.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Revisi About Company terkirim.",
        ticket: result.notrans,
      });
    }

    // --- JALUR SUPERADMIN: DIRECT EXECUTION ---
    await info.update(
      {
        ...packageContent,
        is_locked: false,
        lock_ticket: null,
      },
      { transaction: t },
    );

    await t.commit();
    res.status(200).json({ message: "About Info updated successfully!" });
  } catch (error) {
    if (t) await t.rollback();
    console.error("🚨 [UPDATE ABOUT ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};
