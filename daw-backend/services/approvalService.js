const sequelize = require("../config/database");
const ErpApprovalService = require("./erpApprovalService");
const { commitTempFile } = require("../utils/fileManager");
const { deleteSingleFile } = require("../utils/fileRemover");
const { sendApprovalNotification } = require("../utils/mailer");
const { Op } = require("sequelize");

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
const Achievement = require("../models/Achievement");
const NewsArticle = require("../models/NewsArticle");
const User = require("../models/User");

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
  Achievement,
  NewsArticle,
};

function getModelByModuleName(moduleName) {
  if (!moduleName) return null;
  const normalizedName = moduleName.toLowerCase() === "settings" ? "HomeSettings" : moduleName;
  const standardKey = Object.keys(MODEL_MAPPING).find((k) => k.toLowerCase() === normalizedName.toLowerCase());
  return MODEL_MAPPING[standardKey] || null;
}

class ApprovalService {
  async getPendingApprovals(userRole, karyawanIdForOwl, tokenOWL) {
    const isApproverRole = ["superadmin", "approver"].includes(userRole);

    const owlResponse = await ErpApprovalService.getPendingList({
      karyawanid: karyawanIdForOwl,
      token: tokenOWL,
      limit: 100,
    });

    const myOwlTasks = owlResponse?.data?.rows || [];
    const owlMap = new Map();
    const taskTicketsNormalized = [];

    myOwlTasks.forEach((item) => {
      const ticketNo = (item.notransaksi || item.notrans || "").trim().toLowerCase();
      if (ticketNo) {
        owlMap.set(ticketNo, item);
        taskTicketsNormalized.push(ticketNo);
      }
    });

    let detailedDrafts = [];

    if (isApproverRole) {
      detailedDrafts = await ApprovalDraft.findAll({
        where: {
          [Op.or]: [{ status: "Pending" }, { notrans: { [Op.in]: taskTicketsNormalized } }],
        },
        order: [["createdAt", "DESC"]],
      });
    } else {
      if (taskTicketsNormalized.length === 0) return [];
      detailedDrafts = await ApprovalDraft.findAll({
        where: { notrans: { [Op.in]: taskTicketsNormalized } },
        order: [["createdAt", "DESC"]],
      });
    }

    const draftsWithExtraData = detailedDrafts.map((draft) => {
      const draftJson = draft.toJSON();
      const cleanDraftNo = (draft.notrans || "").trim().toLowerCase();
      const myRow = owlMap.get(cleanDraftNo);

      const owlStatusFinal = myRow ? String(myRow.status) : "9";

      const isActuallyMyTurn = owlStatusFinal === "0" || (owlStatusFinal === "2" && draft.status === "Pending");

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

    if (isApproverRole) {
      const existingNotrans = new Set(draftsWithExtraData.map((d) => d.notrans.toLowerCase()));

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

    return draftsWithExtraData;
  }

  async executeDecision({ status, notrans, level, komentar, tokenOWL, nikApprover }) {
    const currentLevel = Number(level);
    const t = await sequelize.transaction();

    try {
      const owlResponse = await ErpApprovalService.getPendingList({
        karyawanid: nikApprover,
        token: tokenOWL,
        limit: 100,
      });

      const myOwlTasks = owlResponse?.data?.rows || [];
      const realErpTask = myOwlTasks.find((task) => (task.notransaksi || task.notrans || "").trim().toLowerCase() === notrans.toLowerCase());

      if (!realErpTask) throw new Error("Tiket tidak ditemukan di antrean ERP Anda yang aktif. Mungkin sudah dieksekusi.");

      const validExecutionId = realErpTask.nourut || realErpTask.kodeapp;
      if (!validExecutionId) throw new Error("Akses Ditolak: Gagal mengekstrak ID eksekusi dari ERP.");

      const draftData = await ApprovalDraft.findByPk(notrans, { transaction: t });
      if (!draftData) throw new Error("Draf tidak ditemukan di server lokal.");

      const { module_name: moduleName, target_id: targetId, action } = draftData;

      let pureNextApp = "";
      let isFinalLocal = false;

      if (status === "1") {
        const approverRows = await ErpApprovalService._cekSetup(notrans, tokenOWL);
        if (approverRows && approverRows.length > 0) {
          const targetLevel = currentLevel + 1;
          const nextData = approverRows.find((row) => Number(row.level) === targetLevel);
          if (nextData && nextData.karyawanid) {
            pureNextApp = String(nextData.karyawanid);
          } else {
            isFinalLocal = true;
          }
        } else {
          isFinalLocal = true;
        }
      }

      await ErpApprovalService.submitDecision({
        status,
        kodeapp: validExecutionId,
        nourut: validExecutionId,
        notrans,
        level: status === "1" ? currentLevel + 1 : currentLevel,
        komentar,
        nextApp: pureNextApp,
        token: tokenOWL,
        karyawanid: nikApprover,
      });

      if (status === "2") {
        const Model = getModelByModuleName(moduleName);
        if (Model && targetId) {
          await Model.update({ is_locked: false, lock_ticket: null }, { where: { id: targetId }, transaction: t });
        }
        await draftData.update({ status: "Rejected", rejection_reason: komentar }, { transaction: t });

        await t.commit();
        this._notifyActor({ type: "REJECTED", draftData, reason: komentar });
        return { message: "Keputusan ditolak. Data telah dibuka kembali untuk revisi." };
      }

      if (status === "1") {
        if (isFinalLocal) {
          let cleanPayload;
          try {
            const rawPayload = draftData.payload;
            cleanPayload = typeof rawPayload === "string" ? JSON.parse(rawPayload) : JSON.parse(JSON.stringify(rawPayload));
          } catch (e) {
            throw new Error("Payload draf korup.");
          }
          ["id", "createdAt", "updatedAt", "is_locked", "lock_ticket"].forEach((f) => delete cleanPayload[f]);

          cleanPayload.is_locked = false;
          cleanPayload.lock_ticket = null;
          cleanPayload = this.handleFileCommit(cleanPayload);

          const filesToTrash = await this.executeModelUpdate(moduleName, targetId, cleanPayload, action, t);

          await draftData.update({ status: "Approved" }, { transaction: t });
          await t.commit();

          if (filesToTrash && Array.isArray(filesToTrash)) {
            filesToTrash.forEach((file) => file && deleteSingleFile(file));
          }

          this._notifyActor({ type: "APPROVED", draftData });
          return { message: "Persetujuan Final Berhasil. Data telah dipublikasikan!" };
        } else {
          await t.commit();
          this._notifyActor({ type: "NEW_REQUEST", pureNextApp, draftData });
          return { message: `Disetujui di Level ${currentLevel}. Menunggu persetujuan level selanjutnya.` };
        }
      }
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async getOriginalData(module, targetId, action) {
    if (action === "CREATE") return { _system_note: "Ini adalah data baru, belum ada versi Live." };

    const Model = getModelByModuleName(module);
    if (!Model) return null;

    let cleanTargetId = targetId && typeof targetId === "string" ? targetId.trim() : targetId;
    if (["null", "undefined", ""].includes(cleanTargetId)) cleanTargetId = null;

    if (module === "BusinessSection") {
      return await BusinessSection.findByPk(cleanTargetId, { include: [{ model: BusinessMapMarker, as: "mapMarkers" }] });
    }

    if (["AboutInfo", "HomeSettings", "InvestmentSettings", "Settings"].includes(module)) {
      return await Model.findByPk(1);
    }

    if (module === "History") {
      const histories = await History.findAll({ order: [["year", "ASC"]] });
      return { histories: histories.map((h) => ({ year: h.year, text: h.description })) };
    }

    if (!cleanTargetId) return null;
    return await Model.findByPk(cleanTargetId);
  }

  async getRejectedDraftByTarget({ id, module, actorIds }) {
    const draft = await ApprovalDraft.findOne({
      where: {
        target_id: String(id),
        [Op.and]: [
          { module_name: module },
          { status: "Rejected" },
          { created_by: { [Op.in]: actorIds } },
        ],
      },
      order: [["createdAt", "DESC"]],
    });

    if (!draft) return { hasRejected: false };
    return { hasRejected: true, data: draft };
  }

  async discardDraft({ notrans, currentUserIdentities }) {
    const t = await sequelize.transaction();
    try {
      const draft = await ApprovalDraft.findByPk(notrans, { transaction: t });
      if (!draft) {
        await t.rollback();
        throw new Error("NOT_FOUND: Draf tidak ditemukan.");
      }

      if (!currentUserIdentities.includes(String(draft.created_by))) {
        await t.rollback();
        throw new Error("FORBIDDEN: Anda tidak memiliki akses untuk membuang draf ini.");
      }

      if (draft.status !== "Rejected") {
        await t.rollback();
        throw new Error("VALIDATION: Hanya draf yang ditolak yang bisa diabaikan.");
      }

      await draft.update({ status: "Discarded" }, { transaction: t });
      const Model = getModelByModuleName(draft.module_name);
      if (Model && draft.target_id) {
        await Model.update({ is_locked: false, lock_ticket: null }, { where: { id: String(draft.target_id).trim() }, transaction: t });
      }
      await t.commit();
      return { success: true };
    } catch (error) {
      if (t && !t.finished) await t.rollback();
      throw error;
    }
  }

  async forcePurgeGhostTicket({ notrans, nourut, level, komentar, tokenOWL, nikApprover }) {
    const owlResponse = await ErpApprovalService.getPendingList({ karyawanid: nikApprover, token: tokenOWL, limit: 100 });
    const pendingTasks = owlResponse?.data?.rows || [];
    const targetTicket = pendingTasks.find((t) => (t.notransaksi || t.notrans || "").trim().toLowerCase() === notrans.toLowerCase());

    if (!targetTicket) throw new Error("NOT_FOUND: Tiket tidak ditemukan di antrean ERP Anda.");

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
  }

  // ─── UTILITIES ───

  async _notifyActor({ type, pureNextApp, draftData, reason }) {
    try {
      const HIGH_PRIORITY_MODULES = ["NewsArticle", "Project", "Affiliate", "Management", "Achievement", "AboutInfo", "BusinessSection"];
      if (type === "APPROVED" && !HIGH_PRIORITY_MODULES.includes(draftData.module_name)) return;

      let targetUser = null;
      if (type === "NEW_REQUEST" && pureNextApp) {
        targetUser = await User.findOne({ where: { owl_username: pureNextApp } });
      } else if (type === "REJECTED" || type === "APPROVED") {
        targetUser = await User.findOne({
          where: {
            [Op.or]: [{ owl_username: String(draftData.created_by) }, { id: String(draftData.created_by) }, { name: String(draftData.created_by) }],
          },
        });
      }

      if (!targetUser || !targetUser.email) return;

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

  handleFileCommit(payload) {
    if (Array.isArray(payload)) {
      return payload.map((item) => this.handleFileCommit(item));
    } else if (payload !== null && typeof payload === "object") {
      for (const key in payload) {
        if (typeof payload[key] === "string" && payload[key].startsWith("TEMP_")) {
          payload[key] = commitTempFile(payload[key]);
        } else if (typeof payload[key] === "object") {
          payload[key] = this.handleFileCommit(payload[key]);
        }
      }
    }
    return payload;
  }

  async executeModelUpdate(module, targetId, payload, action, transaction) {
    const effectiveModule = module.toLowerCase() === "settings" ? "HomeSettings" : module;
    const Model = getModelByModuleName(effectiveModule);
    if (!Model) throw new Error(`Mapping Model untuk modul '${module}' tidak ditemukan.`);

    const filesToTrash = payload._filesToDelete || [];
    delete payload._filesToDelete;

    const validAttributes = Object.keys(Model.rawAttributes);
    const scrubbedPayload = {};

    Object.keys(payload).forEach((key) => {
      if (validAttributes.includes(key)) scrubbedPayload[key] = payload[key];
    });

    scrubbedPayload.is_locked = false;
    scrubbedPayload.lock_ticket = null;

    if (action === "DELETE") {
      if (effectiveModule === "BusinessSection") await BusinessMapMarker.destroy({ where: { sectionId: targetId }, transaction });
      await Model.destroy({ where: { id: targetId }, transaction });
      return filesToTrash;
    }

    if (action === "CREATE") {
      const placeholder = await Model.findByPk(targetId, { transaction });
      if (placeholder) await placeholder.update(scrubbedPayload, { transaction });
      else await Model.create({ ...scrubbedPayload, id: targetId }, { transaction });
      return filesToTrash;
    }

    const singletonModules = ["AboutInfo", "HomeSettings", "InvestmentSettings", "Settings"];
    if (singletonModules.includes(effectiveModule)) {
      await Model.update(scrubbedPayload, { where: { id: 1 }, transaction });
      return filesToTrash;
    }

    switch (effectiveModule) {
      case "History":
        await History.destroy({ where: {}, transaction });
        if (payload.histories && Array.isArray(payload.histories)) {
          const historyData = payload.histories.map((h) => ({ year: h.year, description: h.description, is_locked: false, lock_ticket: null }));
          await History.bulkCreate(historyData, { transaction });
        }
        break;
      case "BusinessSection":
        const parentPayload = { ...scrubbedPayload };
        delete parentPayload.mapMarkers;
        await BusinessSection.update(parentPayload, { where: { id: targetId }, transaction });
        if (payload.mapMarkers && Array.isArray(payload.mapMarkers)) {
          await BusinessMapMarker.destroy({ where: { sectionId: targetId }, transaction });
          const newMarkers = payload.mapMarkers.map((m) => ({ ...m, id: undefined, sectionId: targetId, is_locked: false, lock_ticket: null }));
          await BusinessMapMarker.bulkCreate(newMarkers, { transaction });
        }
        break;
      case "Menu":
        if (targetId === "ALL_TREE") {
          for (const item of payload.updatedMenus) {
            await Menu.update({ orderIndex: item.orderIndex, parentId: item.parentId }, { where: { id: item.id }, transaction });
          }
          await Menu.update({ is_locked: false, lock_ticket: null }, { where: {}, transaction });
        } else {
          await Model.update(scrubbedPayload, { where: { id: targetId }, transaction });
        }
        break;
      default:
        await Model.update(scrubbedPayload, { where: { id: targetId }, transaction });
        break;
    }

    return filesToTrash;
  }
}

module.exports = new ApprovalService();
