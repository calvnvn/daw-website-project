const sequelize = require("../config/database");
const {
  ErpApprovalService,
  MODULE_REGISTRY,
} = require("../services/erpApprovalService");
const { commitTempFile } = require("../utils/fileManager");
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

    const isApproverRole = ["superadmin", "approver"].includes(userRole);

    // 1. Tarik Data dari ERP OWL (Bisa kosong jika sedang re-index pasca Reject)
    const owlResponse = await ErpApprovalService.getPendingList({
      karyawanid: karyawanIdForOwl,
      token: tokenOWL,
      limit: 100,
    });

    const myOwlTasks = owlResponse?.data?.rows || [];
    const owlMap = new Map();
    const taskTicketsNormalized = [];

    myOwlTasks.forEach((item) => {
      const ticketNo = (item.notransaksi || item.notrans || "")
        .trim()
        .toLowerCase();
      if (ticketNo) {
        owlMap.set(ticketNo, item);
        taskTicketsNormalized.push(ticketNo);
      }
    });

    // 2. THE SOURCE OF TRUTH (MySQL Query)
    let detailedDrafts = [];

    if (isApproverRole) {
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
        where: { notrans: { [Op.in]: taskTicketsNormalized } },
        order: [["createdAt", "DESC"]],
      });
    }

    // 3. STITCHING DATA (Menjahit MySQL + ERP)
    const draftsWithExtraData = detailedDrafts.map((draft) => {
      const draftJson = draft.toJSON();
      const cleanDraftNo = (draft.notrans || "").trim().toLowerCase();

      const myRow = owlMap.get(cleanDraftNo);

      const owlStatusFinal = myRow ? String(myRow.status) : "9";
      const isActuallyMyTurn =
        owlStatusFinal === "0" ||
        (owlStatusFinal === "2" && draft.status === "Pending");
      return {
        ...draftJson,
        nourut: myRow ? myRow.nourut || myRow.kodeapp : null,
        level: myRow ? myRow.level : null,
        kodeapp: myRow ? myRow.kodeapp || myRow.nourut : null,
        nextApp: "",
        isMyQueue: isActuallyMyTurn,
        owlStatus: owlStatusFinal,
        _isSyncing: !myRow && draft.status === "Pending",
      };
    });

    // 4. ORPHAN GHOST HANDLING (Tiket di ERP tapi tidak ada di CMS Lokal)
    if (isApproverRole) {
      const existingNotrans = new Set(
        draftsWithExtraData.map((d) => d.notrans.toLowerCase()),
      );

      myOwlTasks.forEach((owlItem) => {
        const owlNo = (owlItem.notransaksi || owlItem.notrans || "").trim();
        if (owlNo && !existingNotrans.has(owlNo.toLowerCase())) {
          draftsWithExtraData.push({
            notrans: owlNo,
            module_name: "UNKNOWN (Deleted/Legacy Draft)",
            action: "N/A",
            status: "Orphaned",
            isMyQueue: String(owlItem.status) === "0",
            owlStatus: String(owlItem.status),
            _isGhost: true,
          });
        }
      });
    }

    console.log(
      `>>> [STITCHING SUCCESS] Total Tiket Final: ${draftsWithExtraData.length} | ERP Rows: ${myOwlTasks.length}`,
    );

    return res.status(200).json(draftsWithExtraData);
  } catch (error) {
    console.error("🚨 [FETCH ERROR]:", error.message);
    res.status(500).json({ message: "Gagal memuat antrean persetujuan." });
  }
};

// POST: Approve/Reject
exports.executeDecision = async (req, res) => {
  const {
    status,
    kodeapp, // dari frontend
    nourut, // key instance
    notrans: bodyNotrans,
    notransaksi,
    level,
    komentar,
    module: moduleName,
    targetId,
    payload,
    action,
  } = req.body;

  const notrans = bodyNotrans || notransaksi;
  const tokenOWL = req.owl_token;
  const nikApprover = String(req.karyawanId);
  const currentLevel = Number(level);

  try {
    if (!kodeapp) {
      throw new Error("Gagal memproses: kodeapp tidak diterima dari Frontend.");
    }

    //  FASE 1: DINAMISASI NEXTAPP (Baton Pass Logic)
    let pureNextApp = "";
    let isFinalLocal = false;

    if (status === "1") {
      console.log(
        `>>> [BATON PASS] Mencari pelari estafet setelah Lvl ${currentLevel}...`,
      );
      const approverRows = await ErpApprovalService._cekSetup(
        notrans,
        tokenOWL,
      );

      if (approverRows && approverRows.length > 0) {
        const nextLevel = currentLevel + 1;
        const nextData = approverRows.find(
          (row) => Number(row.level) === nextLevel,
        );

        if (nextData && nextData.karyawanid) {
          pureNextApp = String(nextData.karyawanid);
          console.log(
            `>>> [BATON PASS] Target Estafet Ditemukan: ${pureNextApp} (${nextData.namakaryawan})`,
          );
        } else {
          isFinalLocal = true; // Jika tidak ada level selanjutnya, MAKA INI FINAL!
          console.log(
            `>>> [BATON PASS] Tidak ada level ${nextLevel}. Ini adalah Final Approval.`,
          );
        }
      } else {
        // Fallback: Jika gagal tarik setup tapi status 1, kita asumsikan final agar tidak gantung
        isFinalLocal = true;
      }
    }

    console.log(
      `>>> [ERP CALL] Eksekusi -> NoUrut: ${nourut} | NextApp: ${pureNextApp}`,
    );

    //  FASE 2: TEMBAK ERP (MAPPING REMAP)
    await ErpApprovalService.submitDecision({
      status,
      kodeapp: nourut, // WAJIB: API ERP meminta nourut dikirim ke field kodeapp
      nourut: nourut,
      notrans,
      level: currentLevel,
      komentar,
      nextApp: pureNextApp,
      jenisApp: "CMS",
      token: tokenOWL,
      karyawanid: nikApprover,
    });

    // FASE 3: UPDATE DATABASE LOKAL (ORCHESTRATION)
    const t = await sequelize.transaction();

    try {
      // JALUR REJECT
      if (status === "2") {
        const Model = getModelByModuleName(moduleName);
        if (Model && targetId && action !== "CREATE") {
          // Buka gembok data asli agar bisa diedit ulang oleh Editor
          await Model.update(
            { is_locked: false, lock_ticket: null },
            { where: { id: targetId }, transaction: t },
          );
        }
        // Tandai Draf sebagai Ditolak
        await ApprovalDraft.update(
          { status: "Rejected", rejection_reason: komentar },
          { where: { notrans }, transaction: t },
        );
        await t.commit();
        return res.status(200).json({ message: "Rejected & Unlocked." });
      }

      // JALUR APPROVE
      if (status === "1") {
        if (isFinalLocal) {
          console.log(
            `>>> [LOCAL EXECUTION] Memulai injeksi data ke MySQL untuk modul ${moduleName}...`,
          );

          let cleanPayload = { ...payload };
          // Bersihkan field kotor dari Draf
          ["id", "createdAt", "updatedAt", "is_locked", "lock_ticket"].forEach(
            (f) => delete cleanPayload[f],
          );

          // Suntikkan perintah Buka Gembok untuk di-update
          cleanPayload.is_locked = false;
          cleanPayload.lock_ticket = null;

          // FILE COMMIT ENGINE: Ubah file TEMP_ jadi permanen!
          cleanPayload = handleFileCommit(moduleName, cleanPayload);

          // EXECUTION ENGINE: Jalankan update relasional (Induk & Anak)
          await executeModelUpdate(
            moduleName,
            targetId,
            cleanPayload,
            action,
            t,
          );

          await ApprovalDraft.update(
            { status: "Approved" },
            { where: { notrans }, transaction: t },
          );

          await t.commit();
          return res
            .status(200)
            .json({ message: "Final Approval Success. Published!" });
        } else {
          await t.commit();
          return res.status(200).json({
            message: `Level ${currentLevel} Approved. Estafet dilanjutkan ke Approver berikutnya.`,
          });
        }
      }
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }
  } catch (error) {
    console.error("🚨 [EXECUTE DECISION ERROR]:", error.message);
    res
      .status(500)
      .json({ message: "Gagal memproses keputusan.", error: error.message });
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

//  PRIVATE HELPERS (MAINTAINABILITY)
// Mapping Model
function getModelByModuleName(module) {
  const standardKey =
    Object.keys(MODULE_REGISTRY).find(
      (k) => k.toLowerCase() === module.toLowerCase(),
    ) || module;

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
    Settings,
    AboutInfo,
  };

  return mapping[standardKey] || null;
}

// File Commit
function handleFileCommit(module, payload) {
  const fileFields = {
    Project: ["cover_image"],
    Management: ["photoUrl"],
    Affiliate: ["logoUrl"],
    Page: ["heroImage"],
    HeroSlides: ["imageUrl"],
    ImpactStats: ["icon"],
    Settings: ["logoUrl", "faviconUrl"],
  };

  const fields = fileFields[module] || [];

  fields.forEach((field) => {
    if (
      payload[field] &&
      typeof payload[field] === "string" &&
      payload[field].startsWith("TEMP_")
    ) {
      payload[field] = commitTempFile(payload[field]);
    }
  });

  if (module === "Project" && Array.isArray(payload.gallery)) {
    payload.gallery = payload.gallery.map((img) =>
      typeof img === "string" && img.startsWith("TEMP_")
        ? commitTempFile(img)
        : img,
    );
  }

  return payload;
}

// 3. EXECUTION ENGINE
async function executeModelUpdate(
  module,
  targetId,
  payload,
  action,
  transaction,
) {
  const Model = getModelByModuleName(module);

  if (!Model) {
    throw new Error(`Mapping Model untuk modul '${module}' tidak ditemukan.`);
  }

  // PENANGANAN DELETE
  if (action === "DELETE") {
    if (module === "BusinessSection") {
      await BusinessMapMarker.destroy({
        where: { sectionId: targetId },
        transaction,
      });
    }
    return await Model.destroy({ where: { id: targetId }, transaction });
  }

  // PENANGANAN CREATE
  if (action === "CREATE") {
    return await Model.create(payload, { transaction });
  }

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
      await History.destroy({ where: {}, transaction });
      if (payload.histories && Array.isArray(payload.histories)) {
        const historyData = payload.histories.map((h) => ({
          year: h.year,
          description: h.text,
          is_locked: false,
          lock_ticket: null,
        }));
        await History.bulkCreate(historyData, { transaction });
      }
      break;

    case "BusinessSection":
      const parentPayload = { ...payload };
      delete parentPayload.mapMarkers;

      await BusinessSection.update(parentPayload, {
        where: { id: targetId },
        transaction,
      });

      if (payload.mapMarkers && Array.isArray(payload.mapMarkers)) {
        await BusinessMapMarker.destroy({
          where: { sectionId: targetId },
          transaction,
        });
        const newMarkers = payload.mapMarkers.map((m) => ({
          ...m,
          id: undefined,
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
      return await Model.update(payload, {
        where: { id: targetId },
        transaction,
      });
  }
}

// Diff Viewer Data Fetcher
async function fetchOriginalDataByModule(module, targetId) {
  const Model = getModelByModuleName(module);

  if (!Model) {
    console.error(
      `🚨 [DIFF VIEWER] Fatal: Model untuk modul '${module}' tidak ditemukan di mapping!`,
    );
    return null;
  }

  // Sanitasi super ketat ID
  let cleanTargetId =
    targetId && typeof targetId === "string" ? targetId.trim() : targetId;
  if (["null", "undefined", ""].includes(cleanTargetId)) {
    cleanTargetId = null;
  }

  try {
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

    if (!cleanTargetId) return null; // Cegah query melayang

    return await Model.findByPk(cleanTargetId);
  } catch (error) {
    console.error(
      `🚨 [DIFF VIEWER] Sequelize Error query '${Model.tableName}':`,
      error,
    );
    throw error;
  }
}
