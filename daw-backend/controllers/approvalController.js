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
      req.owl_username || req.userId,
      tokenOWL,
    );

    res.status(200).json(pendingList);
  } catch (error) {
    console.error("🚨 [FETCH PENDING ERROR]:", error.message);
    res.status(error.statusCode || 500).json({ message: error.message });
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

      // Buka lock di database lokal agar bisa diedit kembali oleh Editor
     const Model = getModelByModuleName(module);
      if (Model) {
        await Model.update(
          { is_locked: false, lock_ticket: null },
          { where: { id: targetId }, transaction: t }
        );
      }

      await t.commit();
      return res.status(200).json({ message: "Draf berhasil ditolak." });
    }

    // JIKA APPROVE -> Masuk ke Mesin Eksekusi (Mapper)
    if (status === "1") {
      console.log(`⚙️ [EXECUTION ENGINE] Processing Module: ${module} | Ticket: ${notrans}`);

      // Bersihkan payload dari field yang tidak boleh diubah manual
      const cleanPayload = { ...payload };
      delete cleanPayload.id;
      delete cleanPayload.is_locked;
      delete cleanPayload.lock_ticket;

      // Reset Gembok setelah approve sukses
      cleanPayload.is_locked = false;
      cleanPayload.lock_ticket = null;

      // 1. Handle File Staging (Commit TEMP files)
      handleFileCommit(module, cleanPayload);

      // 2. Database Mapping & Update
      await executeModelUpdate(module, targetId, cleanPayload, t);

      // 3. Inform OWL Server
      await ErpApprovalService.submitDecision(notrans, "1", "Disetujui via CMS Dashboard", tokenOWL);

      await t.commit();
      res.status(200).json({ message: `Draf ${module} berhasil dieksekusi ke sistem live.` });
    }
  } catch (error) {
    await t.rollback();
    console.error("🚨 [APPROVAL EXECUTION ERROR]:", error);
    res.status(500).json({ message: "Gagal eksekusi approval.", error: error.message });
  }
};

// GET: Mengambil data asli (Live) dari database lokal untuk komparasi (Diff Viewer)
exports.getOriginalData = async (req, res) => {
  try {
    const { module, targetId } = req.query;
    const data = await fetchOriginalDataByModule(module, targetId);

    if (!data) return res.status(404).json({ message: "Data asli tidak ditemukan." });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// --- PRIVATE HELPERS (MAINTAINABILITY) ---

/**
 * 1. MAPPING MODEL
 * Menghubungkan nama modul dari OWL ke Model Sequelize kita
 */
function getModelByModuleName(module) {
  const mapping = { 
    Project, Management, Affiliate, Page, Menu, 
    MapCategory, BusinessSection, HeroSlide, History, 
    HomeSetting, ImpactStat, InvestmentSettings, Settings, AboutInfo 
  };
  return mapping[module] || null;
}

/**
 * 2. FILE COMMIT ENGINE
 * Mencari semua field yang kemungkinan berisi file TEMP_ dan meresmikannya
 */
function handleFileCommit(module, payload) {
  const fileFields = {
    Project: ['cover_image'],
    Management: ['photoUrl'],
    Affiliate: ['logoUrl'],
    Page: ['heroImage'],
    HeroSlide: ['imageUrl'],
    ImpactStat: ['icon'],
    Settings: ['logoUrl', 'faviconUrl'],
    // AboutInfo, History, dll biasanya teks murni
  };

  const fields = fileFields[module] || [];
  fields.forEach(field => {
    // Jika field ada isinya dan mengandung prefix TEMP_, kita commit
    if (payload[field] && typeof payload[field] === 'string' && payload[field].startsWith('TEMP_')) {
      payload[field] = commitTempFile(payload[field]);
    }
  });

  // Special Case: Gallery Project (Array of Strings)
  if (module === 'Project' && Array.isArray(payload.gallery)) {
    payload.gallery = payload.gallery.map(img => 
      (typeof img === 'string' && img.startsWith('TEMP_')) ? commitTempFile(img) : img
    );
  }
}

/**
 * 3. EXECUTION ENGINE
 * Tempat eksekusi logika update ke MySQL berdasarkan modul
 */
async function executeModelUpdate(module, targetId, payload, transaction) {
  const Model = getModelByModuleName(module);

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
        const historyData = payload.histories.map(h => ({
          year: h.year,
          description: h.text // Mapping dari draf 'text' ke DB 'description'
        }));
        await History.bulkCreate(historyData, { transaction });
      }
      break;

    case "BusinessSection":
      // Update Section Utama
      await BusinessSection.update(payload, { where: { id: targetId }, transaction });
      // Update Markers (Hapus yang lama, pasang yang baru dari draf)
      if (payload.mapMarkers) {
        await BusinessMapMarker.destroy({ where: { sectionId: targetId }, transaction });
        const newMarkers = payload.mapMarkers.map(m => ({ ...m, sectionId: targetId }));
        await BusinessMapMarker.bulkCreate(newMarkers, { transaction });
      }
      break;

    case "Menu":
      if (targetId === "ALL_TREE") {
        // Bulk Update untuk urutan menu
        for (const item of payload.updatedMenus) {
          await Menu.update(
            { orderIndex: item.orderIndex, parentId: item.parentId },
            { where: { id: item.id }, transaction }
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
      include: [{ model: BusinessMapMarker, as: 'mapMarkers' }] 
    });
  }
  
  if (["AboutInfo", "HomeSetting", "InvestmentSettings", "Settings"].includes(module)) {
    return await Model.findByPk(1);
  }

  if (module === "History") {
    const histories = await History.findAll({ order: [['year', 'ASC']] });
    return { histories: histories.map(h => ({ year: h.year, text: h.description })) };
  }

  // Default Fetch
  return Model ? await Model.findByPk(targetId) : null;
}