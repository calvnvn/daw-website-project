const sequelize = require("../config/database");
const { ErpApprovalService } = require("../services/erpApprovalService");
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

const HeroSlides = require("../models/HeroSlides");
const History = require("../models/History");
const HomeSettings = require("../models/HomeSettings");
const ImpactStats = require("../models/ImpactStats");
const InvestmentSettings = require("../models/InvestmentSettings");
const Settings = require("../models/Settings");
const AboutInfo = require("../models/AboutInfo");
const { Op } = require("sequelize");

exports.getPendingApprovals = async (req, res) => {
  try {
    const userRole = req.userRole ? req.userRole.toLowerCase().trim() : "";
    const karyawanIdForOwl = String(req.karyawanId);
    const tokenOWL = req.owl_token;
    const isAdmin = ["superadmin", "admin", "administrator"].includes(userRole);

    const owlResponse = await ErpApprovalService.getPendingList(
      karyawanIdForOwl,
      tokenOWL,
    );
    let myOwlTasks = owlResponse?.data?.rows || [];

    // Normalisasi Nomor Tiket dari Server
    const taskTicketsNormalized = myOwlTasks
      .map((item) => (item.notransaksi || item.notrans || "").trim())
      .filter((t) => t !== "");

    let detailedDrafts = [];
    if (isAdmin) {
      detailedDrafts = await ApprovalDraft.findAll({
        where: {
          [Op.or]: [
            { status: "Pending" },
            { notrans: { [Op.in]: taskTicketsNormalized } },
          ],
        },
        order: [["createdAt", "DESC"]],
      });
    } else {
      if (taskTicketsNormalized.length === 0) return res.status(200).json([]);

      detailedDrafts = await ApprovalDraft.findAll({
        where: {
          notrans: { [Op.in]: taskTicketsNormalized },
        },
        order: [["createdAt", "DESC"]],
      });
    }

    const draftsWithExtraData = detailedDrafts.map((draft) => {
      const draftJson = draft.toJSON();
      const cleanDraftNo = (draft.notrans || "").trim().toLowerCase();

      const myRow = myOwlTasks.find((t) => {
        const owlNo = (t.notransaksi || t.notrans || "").trim().toLowerCase();
        return owlNo === cleanDraftNo;
      });

      // Muncul ke Queue saat ada barisnya dan status harus "0" (Active Turn)
      const owlStatusAsal = myRow ? String(myRow.status) : null;
      const isActuallyMyTurn = owlStatusAsal === "0";

      return {
        ...draftJson,
        nourut: myRow ? myRow.nourut : null,
        level: myRow ? myRow.level : null,
        kodeapp: myRow ? myRow.nourut : null,
        nextApp: "",
        isMyQueue: isActuallyMyTurn,
        owlStatus: owlStatusAsal,
      };
    });
    console.log(
      `>>> [STITCHING SUCCESS] User: ${req.owl_username} | Total: ${draftsWithExtraData.length} Tiket`,
    );
    return res.status(200).json(draftsWithExtraData);
  } catch (error) {
    console.error("🚨 [FETCH ERROR]:", error.message);
    res.status(500).json({ message: "Gagal memuat antrean." });
  }
};

// POST: Approve/Reject
exports.executeDecision = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      status,
      kodeapp,
      notrans: bodyNotrans,
      notransaksi,
      level,
      komentar,
      keteranganRejek,
      nextApp,
      jenisApp,
      nourut,
      module,
      targetId,
      payload,
      action,
    } = req.body;

    const notrans = bodyNotrans || notransaksi;
    if (!notrans)
      throw new Error("Nomor transaksi (notrans) wajib disertakan.");

    const tokenOWL = req.owl_token;
    const nikApprover = String(req.karyawanId);

    const erpResult = await ErpApprovalService.submitDecision({
      kodeapp: kodeapp,
      notrans: notrans,
      level: level,
      status: status,
      komentar: komentar || keteranganRejek,
      nextApp: nextApp,
      jenisApp: jenisApp,
      nourut: nourut,
      token: tokenOWL,
      karyawanid: nikApprover,
    });

    const isFinalApproval = erpResult?.data?.is_final === true;
    console.log(
      `>>> [DECISION DEBUG] Ticket: ${notrans} | Is Final: ${isFinalApproval}`,
    );

    // --- LOGIKA REJECT ---
    if (status === "2") {
      if (action !== "CREATE") {
        const Model = getModelByModuleName(module);
        if (Model && targetId) {
          const queryWhere = targetId === "ALL_TREE" ? {} : { id: targetId };
          await Model.update(
            { is_locked: false, lock_ticket: null },
            { where: queryWhere, transaction: t },
          );
        }
      }
      await ApprovalDraft.update(
        { status: "Rejected", rejection_reason: komentar || keteranganRejek },
        { where: { notrans }, transaction: t },
      );

      await t.commit();
      return res
        .status(200)
        .json({ message: "Draf ditolak dan gembok data telah dibuka." });
    }

    // --- LOGIKA APPROVE ---
    if (status === "1") {
      if (isFinalApproval) {
        const cleanPayload = { ...payload };
        const forbiddenFields = [
          "id",
          "createdAt",
          "updatedAt",
          "is_locked",
          "lock_ticket",
        ];
        forbiddenFields.forEach((field) => delete cleanPayload[field]);

        handleFileCommit(module, cleanPayload);

        cleanPayload.is_locked = false;
        cleanPayload.lock_ticket = null;

        await executeModelUpdate(module, targetId, cleanPayload, action, t);

        await ApprovalDraft.update(
          { status: "Approved" },
          { where: { notrans }, transaction: t },
        );

        await t.commit();
        return res.status(200).json({
          message: `Draf ${module} telah Final dan berhasil dipublish ke Production!`,
          targetId,
        });
      } else {
        console.log(
          `>>> [INFO] Berhasil Approve Lvl ${level}. Menunggu next level.`,
        );
        await t.commit();
        return res.status(200).json({
          message: `Approval berhasil dicatat oleh ERP. Menunggu persetujuan layer berikutnya.`,
          targetId,
        });
      }
    }
  } catch (error) {
    if (t) await t.rollback();
    console.error("🚨 [EXECUTE DECISION ERROR]:", error.message);
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
      order: [["createdAt", "DESC"]],
    });

    if (!draft) {
      return res.status(200).json({
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
    HeroSlides,
    History,
    HomeSettings,
    ImpactStats,
    InvestmentSettings,
    InvestmentSetting: InvestmentSettings,
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
    HeroSlides: ["imageUrl"],
    ImpactStats: ["icon"],
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
  if (!Model)
    throw new Error(`Mapping Model untuk modul '${module}' tidak ditemukan.`);

  if (action === "DELETE") {
    return await Model.destroy({ where: { id: targetId }, transaction });
  }

  if (action === "CREATE") {
    return await Model.create(payload, { transaction });
  }

  // Semua modul yang cuma punya 1 row otomatis dialihkan ke ID 1
  const singletonModules = [
    "AboutInfo",
    "HomeSettings",
    "InvestmentSettings",
    "Settings",
  ];

  if (singletonModules.includes(module)) {
    return await Model.update(payload, { where: { id: 1 }, transaction });
  }

  switch (module) {
    case "History":
      // Pola Replace-All untuk tabel anak (child table)
      await History.destroy({ where: {}, transaction });
      if (payload.histories && Array.isArray(payload.histories)) {
        const historyData = payload.histories.map((h) => ({
          year: h.year,
          description: h.text, // Pastikan ini match dengan nama kolom MySQL lo
          is_locked: false,
          lock_ticket: null,
        }));
        await History.bulkCreate(historyData, { transaction });
      }
      break;

    case "BusinessSection":
      // 1. Update Induk
      await BusinessSection.update(payload, {
        where: { id: targetId },
        transaction,
      });
      // 2. Update Anak (Markers) dengan pola Replace-All
      if (payload.mapMarkers && Array.isArray(payload.mapMarkers)) {
        await BusinessMapMarker.destroy({
          where: { sectionId: targetId },
          transaction,
        });
        const newMarkers = payload.mapMarkers.map((m) => ({
          ...m,
          id: undefined, // Paksa MySQL bikin ID auto-increment baru
          sectionId: targetId,
          is_locked: false,
          lock_ticket: null,
        }));
        await BusinessMapMarker.bulkCreate(newMarkers, { transaction });
      }
      break;

    case "Menu":
      if (targetId === "ALL_TREE") {
        for (const item of payload.updatedMenus) {
          await Menu.update(
            { orderIndex: item.orderIndex, parentId: item.parentId },
            { where: { id: item.id }, transaction },
          );
        }
        await Menu.update(
          { is_locked: false, lock_ticket: null },
          { where: {}, transaction },
        );
      } else {
        await Menu.update(payload, { where: { id: targetId }, transaction });
      }
      break;

    default:
      // Modul Standar (Project, Affiliate, Management, Page, HeroSlides, ImpactStats)
      return await Model.update(payload, {
        where: { id: targetId },
        transaction,
      });
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
      ["AboutInfo", "HomeSettings", "InvestmentSettings", "Settings"].includes(
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
