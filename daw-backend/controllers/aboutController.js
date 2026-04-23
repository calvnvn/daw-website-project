const sequelize = require("../config/database");
const AboutInfo = require("../models/AboutInfo");
const ApprovalDraft = require("../models/ApprovalDraft");
const { ErpApprovalService } = require("../services/erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");

// Helper Pemrosesan Payload
const processAboutPayload = async (req, existingData = {}) => {
  const {
    spiritText,
    missionText,
    visionText,
    philosophyTitle,
    philosophyPillars,
  } = req.body;

  return {
    payload: {
      spiritText: spiritText || existingData.spiritText,
      missionText: missionText || existingData.missionText,
      visionText: visionText || existingData.visionText,
      philosophyTitle: philosophyTitle || existingData.philosophyTitle,
      philosophyPillars: philosophyPillars || existingData.philosophyPillars,
    },
    filesToDelete: [],
  };
};

// GET: Data Info & Philosophy
exports.getAboutInfo = async (req, res) => {
  try {
    const info = await AboutInfo.findByPk(1);
    if (!info) return res.status(404).json({ message: "About info not found" });
    res.status(200).json(info);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch about info" });
  }
};

// PUT: Data Info & Philosophy (Singleton Approval Flow)
exports.updateAboutInfo = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase().trim();
    const { status, previous_notrans } = req.body;

    // Singleton: Selalu gunakan ID 1
    const info = await AboutInfo.findByPk(1, { transaction: t });
    if (!info) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "About info record ID 1 not found" });
    }

    // A. GATEKEEPER: Lock Guard
    if (info.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        message: "Data sedang dikunci oleh proses approval OWL.",
        ticket: info.lock_ticket,
      });
    }

    // B. PROCESSING: Jalankan Helper
    const { payload } = await processAboutPayload(req, info);

    // JALUR 1: EDITOR (Approval Flow)
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        moduleName: "AboutInfo",
        model: AboutInfo,
        targetId: 1,
        action: "UPDATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await info.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        message: "Revisi About Company diajukan ke ERP OWL.",
        ticket: result.notrans,
      });
    }

    // JALUR 2: ADMIN / DIRECT COMMIT
    if (userRole === "superadmin" || userRole === "admin") {
      await invalidateOldDrafts("AboutInfo", 1, t);
    }

    await info.update(
      {
        ...payload,
        is_locked: false,
        lock_ticket: null,
      },
      { transaction: t },
    );

    await t.commit();
    return res
      .status(200)
      .json({ message: "About Info berhasil diperbarui secara langsung." });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [UPDATE ABOUT ERROR]:", error.message);
    res.status(500).json({ message: error.message });
  }
};
