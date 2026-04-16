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

// GET: List Queue dengan Data Lengkap dari Lokal
// GET: List Queue dari DAW API
exports.getPendingApprovals = async (req, res) => {
  try {
    const tokenOWL = req.owl_token;
    const karyawanId = req.owl_username || req.userId;

    const owlResponse = await ErpApprovalService.getPendingList(
      karyawanId,
      tokenOWL,
    );

    // 1. TAMBAHIN LOG INI BUAT NGINTIP BALESAN ASLI MAS RIZKY
    console.log(
      ">>> [DEBUG OWL PENDING]:",
      JSON.stringify(owlResponse, null, 2),
    );

    // 2. EXTRACTION YANG AMAN (Safe Check)
    let pendingTickets = [];

    if (Array.isArray(owlResponse)) {
      // Kasus 1: Mas Rizky langsung balikin Array
      pendingTickets = owlResponse;
    } else if (owlResponse && Array.isArray(owlResponse.data)) {
      // Kasus 2: Mas Rizky balikin { error: false, data: [...] }
      pendingTickets = owlResponse.data;
    } else if (
      owlResponse &&
      owlResponse.data &&
      Array.isArray(owlResponse.data.rows)
    ) {
      // Kasus 3: Mas Rizky balikin { error: false, data: { rows: [...] } }
      pendingTickets = owlResponse.data.rows;
    }

    // 3. JIKA TETAP KOSONG / BUKAN ARRAY
    if (pendingTickets.length === 0) {
      console.log(
        ">>> [INFO] Antrean kosong atau Karyawan ID tidak punya akses approval.",
      );
      return res.status(200).json([]);
    }

    // Karena sekarang pendingTickets DIJAMIN array, .map() nggak akan error lagi
    const ticketNumbers = pendingTickets.map((item) => item.notrans);

    const detailedDrafts = await ApprovalDraft.findAll({
      where: {
        notrans: ticketNumbers,
      },
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(detailedDrafts);
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
        keteranganRejek,
        tokenOWL,
      );
      const Model = getModelByModuleName(module);
      if (Model && targetId) {
        await Model.update(
          { is_locked: false, lock_ticket: null },
          { where: { id: targetId }, transaction: t },
        );
      }

      await ApprovalDraft.update(
        { status: "Rejected" },
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
    const { module, targetId } = req.query;
    const data = await fetchOriginalDataByModule(module, targetId);

    if (!data)
      return res.status(404).json({ message: "Data asli tidak ditemukan." });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRejectedDraftByTarget = async (req, res) => {
  try {
    const { id } = req.params; // Ini targetId (ID Project)
    const { module } = req.query; // Ini nama Modul (Project)

    const draft = await ApprovalDraft.findOne({
      where: {
        target_id: id,
        module_name: module,
        status: "Rejected", // Kita cuma cari yang statusnya ditolak
      },
      order: [["createdAt", "DESC"]], // Ambil yang paling baru ditolak
    });

    if (!draft) {
      return res.status(404).json({ message: "No rejected draft found" });
    }

    res.status(200).json(draft);
  } catch (error) {
    console.error("Error fetching rejected draft:", error);
    res.status(500).json({ message: "Internal Server Error" });
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

  // Custom fetch untuk data yang punya relasi atau singleton
  if (module === "BusinessSection") {
    return await BusinessSection.findByPk(targetId, {
      include: [{ model: BusinessMapMarker, as: "mapMarkers" }],
    });
  }

  if (
    ["AboutInfo", "HomeSetting", "InvestmentSettings", "Settings"].includes(
      module,
    )
  ) {
    return await Model.findByPk(1);
  }

  if (module === "History") {
    const histories = await History.findAll({ order: [["year", "ASC"]] });
    return {
      histories: histories.map((h) => ({ year: h.year, text: h.description })),
    };
  }

  // Default Fetch
  return Model ? await Model.findByPk(targetId) : null;
}
