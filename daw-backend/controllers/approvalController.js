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
const ApprovalDraft = require("../models/ApprovalDraft");

const HeroSlide = require("../models/HeroSlide");
const History = require("../models/History");
const HomeSetting = require("../models/HomeSetting");
const ImpactStat = require("../models/ImpactStat");
const InvestmentSettings = require("../models/InvestmentSettings");
const Settings = require("../models/Settings");
const AboutInfo = require("../models/AboutInfo");

// GET: List Queue dengan Data Lengkap dari Lokal
exports.getPendingApprovals = async (req, res) => {
  try {
    const userRole = req.userRole; // Ambil dari middleware authJwt.js

    // SUPERADMIN: melihat semua list yang statusnya "Pending" di lokal
    if (userRole === "Superadmin" || userRole === "admin") {
      console.log(
        ">>> [APPROVAL CENTER] Mengakses sebagai Superadmin (All Pending Drafts)",
      );

      const allPendingDrafts = await ApprovalDraft.findAll({
        where: { status: "Pending" },
        order: [["createdAt", "DESC"]],
      });

      return res.status(200).json(allPendingDrafts);
    }

    // APPROVER: melihat list yang ditugaskan melalui NIK mereka dari OWL
    console.log(
      ">>> [APPROVAL CENTER] Mengakses sebagai Approver (Syncing with OWL...)",
    );

    const tokenOWL = req.owl_token;
    const karyawanId = req.owl_username || req.userId;

    const owlResponse = await ErpApprovalService.getPendingList(
      karyawanId,
      tokenOWL,
    );
    let pendingTickets = [];

    if (Array.isArray(owlResponse)) {
      // Kasus 1: langsung balikin Array
      pendingTickets = owlResponse;
    } else if (owlResponse && Array.isArray(owlResponse.data)) {
      // Kasus 2: balikin { error: false, data: [...] }
      pendingTickets = owlResponse.data;
    } else if (
      owlResponse &&
      owlResponse.data &&
      Array.isArray(owlResponse.data.rows)
    ) {
      // Kasus 3: balikin { error: false, data: { rows: [...] } }
      pendingTickets = owlResponse.data.rows;
    }

    // Kalau tetep kosong
    if (pendingTickets.length === 0) {
      console.log(
        ">>> [INFO] Antrean kosong atau Karyawan ID tidak punya akses approval di OWL.",
      );
      return res.status(200).json([]);
    }

    // Merge OWL dengan LOKAL
    const ticketNumbers = pendingTickets.map((item) => item.notrans);

    const detailedDrafts = await ApprovalDraft.findAll({
      where: {
        notrans: ticketNumbers,
        status: "Pending", // Pastikan status di lokal juga masih pending
      },
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(detailedDrafts);
  } catch (error) {
    console.error("🚨 [FETCH PENDING ERROR]:", error.message);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// POST: Approve/Reject
exports.executeDecision = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      notrans,
      status,
      keteranganRejek,
      module,
      targetId,
      payload,
      action,
    } = req.body;
    const tokenOWL = req.owl_token;

    // 1. JIKA REJECT
    if (status === "2") {
      await ErpApprovalService.submitDecision(
        notrans,
        "2",
        keteranganRejek || "Ditolak",
        tokenOWL,
      );

      if (action !== "CREATE") {
        const Model = getModelByModuleName(module);
        if (Model && targetId) {
          await Model.update(
            { is_locked: false, lock_ticket: null },
            { where: { id: targetId }, transaction: t },
          );
        }
      }

      await ApprovalDraft.update(
        { status: "Rejected", rejection_reason: keteranganRejek },

        { where: { notrans: notrans }, transaction: t },
      );

      await t.commit();
      return res
        .status(200)
        .json({ message: "Draf ditolak dan gembok dibuka." });
    }

    // 2. JIKA APPROVE
    if (status === "1") {
      const cleanPayload = { ...payload };
      delete cleanPayload.id;

      cleanPayload.is_locked = false;
      cleanPayload.lock_ticket = null;

      await executeModelUpdate(module, targetId, cleanPayload, action, t);

      await ApprovalDraft.update(
        { status: "Approved" },
        { where: { notrans: notrans }, transaction: t },
      );

      await ErpApprovalService.submitDecision(
        notrans,
        "1",
        "Disetujui via CMS",
        tokenOWL,
      );

      await t.commit();

      handleFileCommit(module, cleanPayload);

      res.status(200).json({ message: `Draf ${module} berhasil dipublish!` });
    }
  } catch (error) {
    if (t) await t.rollback();
    res.status(500).json({ message: "Gagal eksekusi.", error: error.message });
  }
};

// GET: Mengambil data asli (Live) dari database lokal untuk komparasi (Diff Viewer)
exports.getOriginalData = async (req, res) => {
  try {
    const { module, targetId, action } = req.query;

    if (action === "CREATE") {
      return res.status(200).json({
        _system_note: "Ini adalah data baru, belum ada versi Live.",
      });
    }
    const data = await fetchOriginalDataByModule(module, targetId);

    if (!data) {
      return res.status(200).json({
        _system_note: `Data Live tidak ditemukan. Pastikan data dengan ID ${targetId} belum dihapus dari database.`,
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error(
      `🚨 [GET ORIGINAL DATA ERROR] Module: ${req.query.module} | Message:`,
      error.message,
    );
    res.status(500).json({
      message: "Terjadi kesalahan saat menarik data Live.",
    });
  }
};

exports.getRejectedDraftByTarget = async (req, res) => {
  try {
    const { id } = req.params; // Target ID
    const { module } = req.query; // Nama Modul

    if (!id || !module) {
      return res.status(400).json({
        message: "Target ID dan Module Name wajib disertakan.",
      });
    }

    const draft = await ApprovalDraft.findOne({
      where: {
        target_id: id,
        module_name: module,
        status: "Rejected",
        created_by: req.owl_username || req.userId,
      },
      order: [["createdAt", "DESC"]], // Ambil yang paling baru ditolak
    });

    if (!draft) {
      return res.status(404).json({
        message: "Tidak ada draf tertunda yang ditolak untuk entitas ini.",
        hasRejected: false,
      });
    }

    res.status(200).json({
      success: true,
      hasRejected: true,
      data: draft,
    });
  } catch (error) {
    console.error(
      `🚨 [RECOVERY API ERROR] ID: ${req.params.id}:`,
      error.message,
    );
    res.status(500).json({ message: "Gagal mengambil data pemulihan." });
  }
};

// --- PRIVATE HELPERS (MAINTAINABILITY) ---
/**
 * 1. MAPPING MODEL
 * Menghubungkan nama modul dari OWL ke Model Sequelize kita
 */
function getModelByModuleName(module) {
  const mapping = {
    Project,
    Management,
    Affiliate,
    Page,
    Menu,
    MapCategory,
    BusinessSection,
    HeroSlide,
    History,
    HomeSetting,
    ImpactStat,
    InvestmentSettings,
    Settings,
    AboutInfo,
  };
  return mapping[module] || null;
}

/**
 * 2. FILE COMMIT ENGINE
 * Mencari semua field yang kemungkinan berisi file TEMP_ dan meresmikannya
 */
function handleFileCommit(module, payload) {
  const fileFields = {
    Project: ["cover_image"],
    Management: ["photoUrl"],
    Affiliate: ["logoUrl"],
    Page: ["heroImage"],
    HeroSlide: ["imageUrl"],
    ImpactStat: ["icon"],
    Settings: ["logoUrl", "faviconUrl"],
    // AboutInfo, History, dll biasanya teks murni
  };

  const fields = fileFields[module] || [];
  fields.forEach((field) => {
    // Jika field ada isinya dan mengandung prefix TEMP_, kita commit
    if (
      payload[field] &&
      typeof payload[field] === "string" &&
      payload[field].startsWith("TEMP_")
    ) {
      payload[field] = commitTempFile(payload[field]);
    }
  });

  // Special Case: Gallery Project (Array of Strings)
  if (module === "Project" && Array.isArray(payload.gallery)) {
    payload.gallery = payload.gallery.map((img) =>
      typeof img === "string" && img.startsWith("TEMP_")
        ? commitTempFile(img)
        : img,
    );
  }
}

/**
 * 3. EXECUTION ENGINE
 * Tempat eksekusi logika update ke MySQL berdasarkan modul
 */
async function executeModelUpdate(
  module,
  targetId,
  payload,
  action,
  transaction,
) {
  const Model = getModelByModuleName(module);

  if (action === "DELETE") {
    return await Model.destroy({ where: { id: targetId }, transaction });
  }

  if (action === "CREATE") {
    payload.is_locked = false;
    payload.lock_ticket = null;
    return await Model.create(payload, { transaction });
  }

  switch (module) {
    case "AboutInfo":
    case "HomeSetting":
    case "InvestmentSettings":
    case "Settings":
      // Modul Singleton (Cuma ada 1 baris, ID biasanya 1)
      await Model.update(payload, { where: { id: 1 }, transaction });
      break;

    case "History":
      // Strategi: Wipe and Replace (Hapus semua, isi baru sesuai draf)
      await History.destroy({ where: {}, transaction });
      if (payload.histories && Array.isArray(payload.histories)) {
        const historyData = payload.histories.map((h) => ({
          year: h.year,
          description: h.text, // Mapping dari draf 'text' ke DB 'description'
        }));
        await History.bulkCreate(historyData, { transaction });
      }
      break;

    case "BusinessSection":
      // Update Section Utama
      await BusinessSection.update(payload, {
        where: { id: targetId },
        transaction,
      });
      // Update Markers (Hapus yang lama, pasang yang baru dari draf)
      if (payload.mapMarkers) {
        await BusinessMapMarker.destroy({
          where: { sectionId: targetId },
          transaction,
        });
        const newMarkers = payload.mapMarkers.map((m) => ({
          ...m,
          sectionId: targetId,
        }));
        await BusinessMapMarker.bulkCreate(newMarkers, { transaction });
      }
      break;

    case "Menu":
      if (targetId === "ALL_TREE") {
        // Bulk Update untuk urutan menu
        for (const item of payload.updatedMenus) {
          await Menu.update(
            { orderIndex: item.orderIndex, parentId: item.parentId },
            { where: { id: item.id }, transaction },
          );
        }
      } else {
        await Menu.update(payload, { where: { id: targetId }, transaction });
      }
      break;

    default:
      // Modul standar (Project, Management, Affiliate, Page, HeroSlide, ImpactStat, MapCategory)
      if (Model) {
        await Model.update(payload, { where: { id: targetId }, transaction });
      } else {
        throw new Error(`Execution Logic for ${module} not implemented.`);
      }
  }
}

/**
 * 4. DIFF VIEWER DATA FETCHER
 * Mengambil data "Live" untuk dibandingkan dengan "Draf" di Frontend
 */
async function fetchOriginalDataByModule(module, targetId) {
  const Model = getModelByModuleName(module);

  if (!Model) {
    console.error(
      `🚨 [DIFF VIEWER] Fatal: Model untuk modul '${module}' tidak ditemukan di mapping!`,
    );
    return null;
  }

  // 2. SANITASI SUPER KETAT (Membunuh White Space dan Stringified Null)
  let cleanTargetId = null;
  if (targetId && typeof targetId === "string") {
    cleanTargetId = targetId.trim();
    if (
      cleanTargetId === "null" ||
      cleanTargetId === "undefined" ||
      cleanTargetId === ""
    ) {
      cleanTargetId = null;
    }
  } else {
    cleanTargetId = targetId;
  }

  console.log(
    `>>> [DIFF VIEWER] Mencari versi Live | Modul: ${module} | Clean ID: '${cleanTargetId}'`,
  );

  try {
    // Custom fetch untuk data yang punya relasi atau singleton
    if (module === "BusinessSection") {
      return await BusinessSection.findByPk(cleanTargetId, {
        include: [{ model: BusinessMapMarker, as: "mapMarkers" }],
      });
    }

    if (
      ["AboutInfo", "HomeSetting", "InvestmentSettings", "Settings"].includes(
        module,
      )
    ) {
      // Modul Singleton selalu pakai ID 1
      return await Model.findByPk(1);
    }

    if (module === "History") {
      const histories = await History.findAll({ order: [["year", "ASC"]] });
      return {
        histories: histories.map((h) => ({
          year: h.year,
          text: h.description,
        })),
      };
    }

    // 3. PENCEGAHAN QUERY KOSONG
    if (!cleanTargetId) {
      console.warn(
        `⚠️ [DIFF VIEWER] Target ID kosong setelah sanitasi. Batal query ke database.`,
      );
      return null;
    }

    // Default Fetch (Project, Affiliate, Management, Page, dll)
    const data = await Model.findByPk(cleanTargetId);

    if (!data) {
      console.warn(
        `⚠️ [DIFF VIEWER] Data GHOST! Record '${cleanTargetId}' tidak ada di tabel '${Model.tableName}'`,
      );
    } else {
      console.log(`>>> [DIFF VIEWER] Data Live Ditemukan! Sukses.`);
    }

    return data;
  } catch (error) {
    console.error(
      `🚨 [DIFF VIEWER] Sequelize Error saat query tabel '${Model.tableName}':`,
      error,
    );
    throw error;
  }
}
