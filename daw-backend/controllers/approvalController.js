const sequelize = require("../config/database");
const ErpApprovalService = require("../services/erpApprovalService");
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
const Philosophy = require("../models/Philosophy");
const PhilosophyPillar = require("../models/PhilosophyPillar");
const HeroSlides = require("../models/HeroSlides");
const History = require("../models/History");
const HomeSettings = require("../models/HomeSettings");
const ImpactStats = require("../models/ImpactStats");
const InvestmentSettings = require("../models/InvestmentSettings");
const Settings = require("../models/Settings");
const AboutInfo = require("../models/AboutInfo");
const { Op } = require("sequelize");
const { deleteSingleFile } = require("../utils/fileRemover");
const User = require("../models/User");
const { sendApprovalNotification } = require("../utils/mailer");

/**
 * Orchestrates the multi-stage approval lifecycle by synchronizing internal
 * SQL drafts with external ERP workflow states.
 */
exports.getPendingApprovals = async (req, res) => {
  try {
    const userRole = req.userRole ? req.userRole.toLowerCase().trim() : "";
    const karyawanIdForOwl = String(req.karyawanId);
    const tokenOWL = req.owl_token;

    const isApproverRole = ["superadmin", "approver"].includes(userRole);

    // Fetch external pending task list from ERP OWL node
    const owlResponse = await ErpApprovalService.getPendingList({
      karyawanid: karyawanIdForOwl,
      token: tokenOWL,
      limit: 100,
    });

    const myOwlTasks = owlResponse?.data?.rows || [];
    const owlMap = new Map();
    const taskTicketsNormalized = [];

    // Normalize and map external tickets for local correlation
    myOwlTasks.forEach((item) => {
      const ticketNo = (item.notransaksi || item.notrans || "")
        .trim()
        .toLowerCase();
      if (ticketNo) {
        owlMap.set(ticketNo, item);
        taskTicketsNormalized.push(ticketNo);
      }
    });

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
      // Retrieve internal draft details based on user authorization levels
      detailedDrafts = await ApprovalDraft.findAll({
        where: { notrans: { [Op.in]: taskTicketsNormalized } },
        order: [["createdAt", "DESC"]],
      });
    }

    // Correlate ERP state with local payload to determine queue priority
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

    // Identify orphaned ERP tickets missing corresponding local draft records
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
            nourut: owlItem.nourut || owlItem.kodeapp,
            kodeapp: owlItem.kodeapp || owlItem.nourut,
            level: owlItem.level,
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

// Execute decision logic and manage data handover (POST /node/approval/trans/submitApp)
exports.executeDecision = async (req, res) => {
  const {
    status,
    // kodeapp, // Reference to 'nourut' from ERP
    // nourut,
    notrans: bodyNotrans,
    notransaksi,
    level,
    komentar,
  } = req.body;

  const notrans = bodyNotrans || notransaksi;
  const tokenOWL = req.owl_token;
  const nikApprover = String(req.karyawanId);
  const currentLevel = Number(level);

  // Initialize transaction to ensure atomicity across local state changes
  const t = await sequelize.transaction();

  try {
    const owlResponse = await ErpApprovalService.getPendingList({
      karyawanid: nikApprover,
      token: tokenOWL,
      limit: 100,
    });

    const myOwlTasks = owlResponse?.data?.rows || [];
    const realErpTask = myOwlTasks.find(
      (task) =>
        (task.notransaksi || task.notrans || "").trim().toLowerCase() ===
        notrans.toLowerCase(),
    );

    if (!realErpTask) {
      throw new Error(
        "Tiket tidak ditemukan di antrean ERP Anda yang aktif. Mungkin sudah dieksekusi.",
      );
    }

    // Ekstrak ID Eksekusi langsung dari sumber aslinya (ERP)
    const validExecutionId = realErpTask.nourut || realErpTask.kodeapp;

    if (!validExecutionId) {
      throw new Error("Akses Ditolak: Gagal mengekstrak ID eksekusi dari ERP.");
    }

    // Validate draft existence within the staging vault
    const draftData = await ApprovalDraft.findByPk(notrans, { transaction: t });
    if (!draftData) throw new Error("Draf tidak ditemukan di server lokal.");

    const {
      module_name: moduleName,
      target_id: targetId,
      action,
      payload,
    } = draftData;

    let pureNextApp = "";
    let isFinalLocal = false;

    // Discovery phase: identify subsequent approver or determine finalization state
    if (status === "1") {
      const approverRows = await ErpApprovalService._cekSetup(
        notrans,
        tokenOWL,
      );
      if (approverRows && approverRows.length > 0) {
        const targetLevel = currentLevel + 1;
        const nextData = approverRows.find(
          (row) => Number(row.level) === targetLevel,
        );

        if (nextData && nextData.karyawanid) {
          pureNextApp = String(nextData.karyawanid);
        } else {
          isFinalLocal = true; // No more runners found
        }
      } else {
        isFinalLocal = true; // Fallback to final if setup missing
      }
    }

    // Update external workflow state via ERP API before local commit
    await ErpApprovalService.submitDecision({
      status,
      kodeapp: validExecutionId, // 👈 Terjamin akurat
      nourut: validExecutionId, // 👈 Terjamin akurat
      notrans,
      level: status === "1" ? currentLevel + 1 : currentLevel,
      komentar,
      nextApp: pureNextApp,
      token: tokenOWL,
      karyawanid: nikApprover,
    });

    // Handle rejection: unlock target record and revert control to editor
    if (status === "2") {
      const Model = getModelByModuleName(moduleName);
      if (Model && targetId) {
        await Model.update(
          { is_locked: false, lock_ticket: null },
          { where: { id: targetId }, transaction: t },
        );
      }
      await draftData.update(
        { status: "Rejected", rejection_reason: komentar },
        { transaction: t },
      );

      await t.commit();
      _notifyActor({ type: "REJECTED", draftData, reason: komentar });
      return res.status(200).json({
        message: "Keputusan ditolak. Data telah dibuka kembali untuk revisi.",
      });
    }

    // Handle approval: promote draft payload to production table upon final level
    if (status === "1") {
      if (isFinalLocal) {
        console.log(
          ">>> [HANDOVER] Memulai proses finalisasi ke tabel utama...",
        );

        let cleanPayload;
        try {
          const rawPayload = draftData.payload;
          cleanPayload =
            typeof rawPayload === "string"
              ? JSON.parse(rawPayload)
              : JSON.parse(JSON.stringify(rawPayload));
        } catch (e) {
          throw new Error("Payload draf korup.");
        }
        ["id", "createdAt", "updatedAt", "is_locked", "lock_ticket"].forEach(
          (f) => delete cleanPayload[f],
        );

        cleanPayload.is_locked = false;
        cleanPayload.lock_ticket = null;

        // Sanitize and commit temporary files to production storage
        cleanPayload = handleFileCommit(cleanPayload);

        // Scrub payload against model attributes and execute CRUD operation
        const filesToTrash = await executeModelUpdate(
          moduleName,
          targetId,
          cleanPayload,
          action,
          t,
        );

        await draftData.update({ status: "Approved" }, { transaction: t });

        await t.commit();

        if (filesToTrash && Array.isArray(filesToTrash)) {
          filesToTrash.forEach((file) => file && deleteSingleFile(file));
        }

        _notifyActor({ type: "APPROVED", draftData });

        console.log(`✅ [SUCCESS] Handover ${moduleName} selesai sempurna.`);
        return res.status(200).json({
          message: "Persetujuan Final Berhasil. Data telah dipublikasikan!",
        });
      } else {
        await t.commit();
        _notifyActor({ type: "NEW_REQUEST", pureNextApp, draftData });
        return res.status(200).json({
          message: `Disetujui di Level ${currentLevel}. Menunggu persetujuan level selanjutnya.`,
        });
      }
    }
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [DECISION ENGINE ERROR]:", error.message);
    res.status(500).json({
      message:
        "Gagal memproses keputusan. Silakan hubungi IT jika masalah berlanjut.",
      error: error.message,
    });
  }
};

// Retrieve live production data for comparative diff visualization
exports.getOriginalData = async (req, res) => {
  try {
    const { module, targetId, action } = req.query;

    if (action === "CREATE") {
      return res
        .status(200)
        .json({ _system_note: "Ini adalah data baru, belum ada versi Live." });
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
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat menarik data Live." });
  }
};

// Identify recent rejection history for record recovery logic
exports.getRejectedDraftByTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { module } = req.query;

    if (!id || !module) {
      return res
        .status(400)
        .json({ message: "Target ID dan Module Name wajib disertakan." });
    }

    const username = req.owl_username;
    const karyawanId = req.karyawanId;
    const userId = req.userId;

    const actorId = String(req.owl_username || req.karyawanId || req.userId);

    const draft = await ApprovalDraft.findOne({
      where: {
        target_id: String(id),
        [Op.and]: [
          { module_name: module },
          { status: "Rejected" },
          {
            [Op.or]: [
              { created_by: String(username) },
              { created_by: String(karyawanId) },
              { created_by: String(userId) },
            ],
          },
        ],
      },
      order: [["createdAt", "DESC"]],
    });

    if (!draft) {
      // console.log(
      //   `🔍 [RECOVERY] Not found for ID: ${id}. Checked identities: ${username}, ${karyawanId}`,
      // );
      return res.status(200).json({
        message: "Tidak ada draf tertunda.",
        hasRejected: false,
      });
    }

    res.status(200).json({ success: true, hasRejected: true, data: draft });
  } catch (error) {
    console.error(
      `🚨 [RECOVERY API ERROR] ID: ${req.params.id}:`,
      error.message,
    );
    res.status(500).json({ message: "Gagal mengambil data pemulihan." });
  }
};

// Update draft status and release record concurrency locks (PATCH /approval/discard/:notrans)
exports.discardDraft = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { notrans } = req.body;

    const currentUserIdentities = [
      req.owl_username ? String(req.owl_username) : null,
      req.karyawanId ? String(req.karyawanId) : null,
      req.userId ? String(req.userId) : null,
    ].filter(Boolean);

    const draft = await ApprovalDraft.findByPk(notrans, { transaction: t });

    if (!draft) {
      await t.rollback();
      return res.status(404).json({ message: "Draf tidak ditemukan." });
    }

    if (!currentUserIdentities.includes(String(draft.created_by))) {
      await t.rollback();

      console.log(
        `🚨 [DISCARD BLOCKED] Pembuat Draf: ${draft.created_by} | ID Kamu:`,
        currentUserIdentities,
      );

      return res.status(403).json({
        message: "Anda tidak memiliki akses untuk membuang draf ini.",
      });
    }

    if (draft.status !== "Rejected") {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Hanya draf yang ditolak yang bisa diabaikan." });
    }

    await draft.update({ status: "Discarded" }, { transaction: t });
    const Model = getModelByModuleName(draft.module_name);
    if (Model && draft.target_id) {
      const cleanId = String(draft.target_id).trim();

      await Model.update(
        { is_locked: false, lock_ticket: null },
        {
          where: { id: cleanId },
          transaction: t,
        },
      );
      console.log(
        `>>> [DISCARD UNLOCK] Gembok ${draft.module_name} ID ${cleanId} dibuka.`,
      );
    }
    await t.commit();

    res.status(200).json({
      success: true,
      message: "Notifikasi draf telah diabaikan.",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [DISCARD ERROR]:", error.message);
    res.status(500).json({ message: "Gagal mengabaikan draf." });
  }
};

// Forcefully synchronize and reject orphaned ERP tickets (POST /node/approval/trans/submitApp)
exports.forcePurgeGhostTicket = async (req, res) => {
  const { notrans, nourut, level, komentar } = req.body;
  const tokenOWL = req.owl_token;
  const nikApprover = String(req.karyawanId);

  try {
    console.log(
      `⚠️  [GHOST BUSTER] Memulai Force Purge untuk tiket: ${notrans}`,
    );

    // Fetch live data directly from ERP Node
    const owlResponse = await ErpApprovalService.getPendingList({
      karyawanid: nikApprover,
      token: tokenOWL,
      limit: 100,
    });

    const pendingTasks = owlResponse?.data?.rows || [];
    const targetTicket = pendingTasks.find(
      (t) =>
        (t.notransaksi || t.notrans || "").trim().toLowerCase() ===
        notrans.toLowerCase(),
    );

    if (!targetTicket) {
      console.warn(
        `🚨 [GHOST BUSTER] Tiket ${notrans} tidak ditemukan di antrean ERP aktif.`,
      );
      return res
        .status(404)
        .json({ message: "Tiket tidak ditemukan di antrean ERP Anda." });
    }
    await ErpApprovalService.submitDecision({
      status: "2",
      nourut: nourut,
      notrans: notrans,
      level: Number(level),
      komentar: komentar || "SYSTEM PURGE: Local Draft Missing",
      nextApp: "",
      token: tokenOWL,
      karyawanid: nikApprover,
    });

    console.log(
      `✅ [GHOST BUSTER] Tiket ${notrans} berhasil dibersihkan dari ERP.`,
    );

    return res.status(200).json({
      success: true,
      message: "Tiket yatim piatu berhasil dimusnahkan dari antrean ERP.",
    });
  } catch (error) {
    console.error("🚨 [GHOST BUSTER ERROR]:", error.message);
    res.status(500).json({
      message: "Gagal membersihkan tiket dari ERP DAW.",
      error: error.message,
    });
  }
};

/**
 * Internal Helper Functions
 */

// Maps module string identifiers to Sequelize model definitions
const MODEL_MAPPING = {
  Project,
  Management,
  Affiliate,
  Page,
  Menu,
  MapCategory,
  BusinessSection,
  BusinessMapMarker,
  HeroSlides,
  History,
  HomeSettings,
  ImpactStats,
  InvestmentSettings,
  Settings,
  AboutInfo,
  Philosophy,
  PhilosophyPillar,
};

function getModelByModuleName(moduleName) {
  if (!moduleName) return null;
  const normalizedName =
    moduleName.toLowerCase() === "settings" ? "HomeSettings" : moduleName;

  const standardKey = Object.keys(MODEL_MAPPING).find(
    (k) => k.toLowerCase() === normalizedName.toLowerCase(),
  );
  return MODEL_MAPPING[standardKey] || null;
}

// Dispatches asynchronous email notifications to workflow participants
async function _notifyActor({ type, pureNextApp, draftData, reason }) {
  try {
    let targetUser = null;

    if (type === "NEW_REQUEST" && pureNextApp) {
      targetUser = await User.findOne({ where: { owl_username: pureNextApp } });
    } else if (type === "REJECTED" || type === "APPROVED") {
      targetUser = await User.findOne({
        where: {
          [Op.or]: [
            { owl_username: String(draftData.created_by) },
            { id: String(draftData.created_by) },
            { name: String(draftData.created_by) },
          ],
        },
      });
    }

    if (!targetUser || !targetUser.email) {
      console.log(
        `⚠️ [MAIL SKIP] Target email tidak ditemukan untuk identifier: ${pureNextApp || draftData.created_by}`,
      );
      return;
    }

    await sendApprovalNotification({
      toEmail: targetUser.email,
      recipientName: targetUser.name || "Tim DAW",
      type: type,
      draftInfo: {
        notrans: draftData.notrans,
        module_name: draftData.module_name,
        action: draftData.action,
        created_by: draftData.created_by,
      },
      reason: reason,
    });
  } catch (error) {
    console.error("🚨 [_notifyActor ERROR]:", error.message);
  }
}

// Recursively promotes temporary file paths to production storage paths
function handleFileCommit(payload) {
  if (Array.isArray(payload)) {
    return payload.map((item) => handleFileCommit(item));
  } else if (payload !== null && typeof payload === "object") {
    for (const key in payload) {
      if (
        typeof payload[key] === "string" &&
        payload[key].startsWith("TEMP_")
      ) {
        payload[key] = commitTempFile(payload[key]);
      } else if (typeof payload[key] === "object") {
        payload[key] = handleFileCommit(payload[key]);
      }
    }
  }
  return payload;
}

// Scrubs payload and executes final persistence logic on production tables
async function executeModelUpdate(
  module,
  targetId,
  payload,
  action,
  transaction,
) {
  const effectiveModule =
    module.toLowerCase() === "settings" ? "HomeSettings" : module;
  const Model = getModelByModuleName(effectiveModule);

  if (!Model) {
    throw new Error(`Mapping Model untuk modul '${module}' tidak ditemukan.`);
  }

  const filesToTrash = payload._filesToDelete || [];
  delete payload._filesToDelete;

  const validAttributes = Object.keys(Model.rawAttributes);
  const scrubbedPayload = {};

  Object.keys(payload).forEach((key) => {
    if (validAttributes.includes(key)) {
      scrubbedPayload[key] = payload[key];
    }
  });

  scrubbedPayload.is_locked = false;
  scrubbedPayload.lock_ticket = null;

  console.log(
    `>>> [SCRUBBING] Module: ${effectiveModule} | Accepted Keys:`,
    Object.keys(scrubbedPayload),
  );

  if (action === "DELETE") {
    if (effectiveModule === "BusinessSection") {
      await BusinessMapMarker.destroy({
        where: { sectionId: targetId },
        transaction,
      });
    }
    await Model.destroy({ where: { id: targetId }, transaction });
    return filesToTrash;
  }

  if (action === "CREATE") {
    const placeholder = await Model.findByPk(targetId, { transaction });
    if (placeholder) {
      await placeholder.update(scrubbedPayload, { transaction });
      console.log(
        `>>> [HANDOVER SUCCESS] ${effectiveModule} ID ${targetId} Updated.`,
      );
    } else {
      await Model.create({ ...scrubbedPayload, id: targetId }, { transaction });
      console.log(
        `>>> [DIRECT CREATE] ${effectiveModule} ID ${targetId} Created.`,
      );
    }
    return filesToTrash;
  }

  const singletonModules = [
    "AboutInfo",
    "HomeSettings",
    "InvestmentSettings",
    "Settings",
  ];

  if (singletonModules.includes(effectiveModule)) {
    await Model.update(scrubbedPayload, {
      where: { id: 1 },
      transaction,
    });
    return filesToTrash;
  }

  switch (effectiveModule) {
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
      const parentPayload = { ...scrubbedPayload };
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
        await Menu.update(scrubbedPayload, {
          where: { id: targetId },
          transaction,
        });
      }
      break;

    default:
      await Model.update(scrubbedPayload, {
        where: { id: targetId },
        transaction,
      });
      break;
  }

  return filesToTrash;
}

// Retrieves current record state for comparative visualization
async function fetchOriginalDataByModule(module, targetId) {
  const Model = getModelByModuleName(module);

  if (!Model) {
    console.error(
      `🚨 [DIFF VIEWER] Fatal: Model untuk modul '${module}' tidak ditemukan di mapping!`,
    );
    return null;
  }

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

    if (!cleanTargetId) return null;

    return await Model.findByPk(cleanTargetId);
  } catch (error) {
    console.error(
      `🚨 [DIFF VIEWER] Sequelize Error query '${Model.tableName}':`,
      error.message,
    );
    throw error;
  }
}
