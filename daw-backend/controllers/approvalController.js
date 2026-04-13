const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
const { commitTempFile } = require("../utils/fileManager"); // Helper yang baru kita buat

// Import semua model yang terlibat dalam draf
const Project = require("../models/Project");
const Management = require("../models/Management");
const Affiliate = require("../models/Affiliate");
const Page = require("../models/Page");
const Menu = require("../models/Menu");
const MapCategory = require("../models/MapCategory");
const BusinessSection = require("../models/BusinessSection");
const BusinessMapMarker = require("../models/BusinessMapMarker");

// GET: List Queue from DAW API
exports.getPendingApprovals = async (req, res) => {
  try {
    const tokenOWL = req.headers["authorization"]?.split(" ")[1];
    // Asumsi req.userId adalah NIK/ID Karyawan Admin dari JWT
    const pendingList = await ErpApprovalService.getPendingList(
      req.userId,
      process.env.CMS_APPROVAL_CODE,
      tokenOWL,
    );

    res.status(200).json(pendingList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST: Approve/Reject
exports.executeDecision = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { notrans, status, keteranganRejek, module, targetId, payload } =
      req.body;
    const tokenOWL = req.headers["authorization"]?.split(" ")[1];

    // JIKA REJECT (Tolak) -> Langsung tembak OWL, nggak perlu update DB lokal
    if (status === "2") {
      await ErpApprovalService.submitDecision(
        notrans,
        "2",
        keteranganRejek || "Ditolak Admin",
        tokenOWL,
      );
      await t.commit();
      return res.status(200).json({ message: "Draf berhasil ditolak." });
    }

    // JIKA APPROVE -> Masuk ke Mesin Eksekusi (Mapper)
    if (status === "1") {
      console.log(`⚙️ [EXECUTION ENGINE] Mulai memproses modul: ${module}`);

      switch (module) {
        case "Project":
          // Patenkan Cover
          if (payload.cover_image) {
            payload.cover_image = commitTempFile(payload.cover_image);
          }
          // Patenkan Gallery
          if (payload.gallery && Array.isArray(payload.gallery)) {
            payload.gallery = payload.gallery.map((img) => commitTempFile(img));
          }
          await Project.update(payload, {
            where: { id: targetId },
            transaction: t,
          });
          break;

        case "Management":
          if (payload.photoUrl)
            payload.photoUrl = commitTempFile(payload.photoUrl);
          await Management.update(payload, {
            where: { id: targetId },
            transaction: t,
          });
          break;

        case "Affiliate":
          if (payload.logoUrl)
            payload.logoUrl = commitTempFile(payload.logoUrl);
          await Affiliate.update(payload, {
            where: { id: targetId },
            transaction: t,
          });
          break;

        case "Page":
          if (payload.heroImage)
            payload.heroImage = commitTempFile(payload.heroImage);
          await Page.update(payload, {
            where: { id: targetId },
            transaction: t,
          });
          break;

        case "Menu":
          if (targetId === "ALL_TREE") {
            // Logic Bulk Reorder Menu
            for (const item of payload.updatedMenus) {
              await Menu.update(
                { orderIndex: item.orderIndex, parentId: item.parentId },
                { where: { id: item.id }, transaction: t },
              );
            }
          } else {
            // Update Menu Satuan
            await Menu.update(payload, {
              where: { id: targetId },
              transaction: t,
            });
          }
          break;

        case "BusinessSection":
          await BusinessSection.update(payload, {
            where: { id: targetId },
            transaction: t,
          });
          await BusinessMapMarker.destroy({
            where: { sectionId: targetId },
            transaction: t,
          });
          if (payload.mapMarkers && payload.mapMarkers.length > 0) {
            const newMarkers = payload.mapMarkers.map((m) => ({
              ...m,
              sectionId: targetId,
            }));
            await BusinessMapMarker.bulkCreate(newMarkers, { transaction: t });
          }
          break;

        case "MapCategory":
          await MapCategory.update(payload, {
            where: { id: targetId },
            transaction: t,
          });
          break;

        case "AboutInfo":
          await sequelize.query(
            "UPDATE AboutInfo SET spiritText = :spiritText, missionText = :missionText, visionText = :visionText, philosophyTitle = :philosophyTitle, philosophyPillars = :philosophyPillars WHERE id = 1",
            {
              replacements: {
                ...payload,
                philosophyPillars: JSON.stringify(
                  payload.philosophyPillars || [],
                ),
              },
              type: sequelize.QueryTypes.UPDATE,
              transaction: t,
            },
          );
          break;

        case "History":
          await sequelize.query("DELETE FROM Histories", { transaction: t });
          if (payload.histories && payload.histories.length > 0) {
            for (const item of payload.histories) {
              await sequelize.query(
                "INSERT INTO Histories (year, description) VALUES (:year, :desc)",
                {
                  replacements: { year: item.year, desc: item.text },
                  type: sequelize.QueryTypes.INSERT,
                  transaction: t,
                },
              );
            }
          }
          break;

        default:
          throw new Error(
            `Modul ${module} tidak dikenali oleh Mesin Eksekusi.`,
          );
      }

      // Setelah Database Lokal sukses, baru kasih tau DAW API kalau tiketnya sudah di-Approve
      await ErpApprovalService.submitDecision(
        notrans,
        "1",
        "Disetujui Admin",
        tokenOWL,
      );

      await t.commit();
      res.status(200).json({
        message: `Draf ${module} berhasil disetujui dan dieksekusi ke sistem.`,
      });
    }
  } catch (error) {
    await t.rollback();
    console.error("🚨 [APPROVAL EXECUTION ERROR]:", error);
    res
      .status(500)
      .json({ message: "Gagal mengeksekusi approval.", error: error.message });
  }
};
