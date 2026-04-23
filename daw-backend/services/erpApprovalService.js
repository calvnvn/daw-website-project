const axios = require("axios");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");
const { generateNotrans } = require("../utils/notransGenerator");

const CMS_CODE = process.env.CMS_APPROVAL_CODE;

const dawApi = axios.create({
  baseURL: process.env.DAW_NODE_URL,
  timeout: 10000,
});

const MODULE_REGISTRY = {
  AboutInfo: "AboutInfo",
  Affiliate: "Affiliates",
  BusinessSection: "BusinessSections",
  HeroSlide: "HeroSlides",
  History: "Histories",
  ImpactStat: "ImpactStats",
  InvestmentSetting: "InvestmentSettings",
  Management: "Managements",
  Menu: "Menus",
  Page: "Pages",
  Project: "Projects",
  Settings: "Settings",
};

class ErpApprovalService {
  static _handleError(error, context) {
    const status = error.response?.status || "NETWORK_ERROR";
    const erpMessage = error.response?.data?.message || error.message;

    console.error(
      `🚨 [ERP ERROR - ${context}] Status: ${status}`,
      error.response?.data || error.message,
    );

    const newError = new Error(`ERP DAW Error (${context}): ${erpMessage}`);
    newError.statusCode = status;
    newError.originalError = error;
    throw newError;
  }

  // Handshake: Cek Setup
  static async _cekSetup(notrans, token) {
    try {
      const payload = {
        notrans: notrans,
        jenisApp: CMS_CODE,
      };

      const response = await dawApi.post(
        "/node/approval/setup/cekSetup",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return response.data?.data?.rows || [];
    } catch (error) {
      console.error(`🚨 ERP cekSetup API Error [${notrans}]:`, error.message);
      return [];
    }
  }

  // Submit For Approval /trans/add
  static async initiateApproval({
    moduleName,
    model,
    targetId,
    action,
    payload,
    userId,
    owlUsername,
    karyawanId,
    token,
    transaction,
  }) {
    if (!transaction) {
      throw new Error(
        "Sistem Error: initiateApproval membutuhkan context transaction.",
      );
    }

    const rawModuleName = moduleName || (model && model.name);

    const standardizedKey =
      Object.keys(MODULE_REGISTRY).find(
        (key) => key.toLowerCase() === rawModuleName.toLowerCase(),
      ) || rawModuleName;

    const notrans = await generateNotrans(rawModuleName);
    const actorId = String(owlUsername || userId);
    console.log(
      `>>> [STRICT DEBUG] actorId (inputby) dikirim sebagai: ${actorId}`,
    );

    console.log(
      `>>> [ERP SERVICE] 1. Discovery: Checking setup for ${notrans}...`,
    );
    const approverRows = await this._cekSetup(notrans, token);
    console.log(">>> [DEBUG INJECTION] Tiket:", notrans);
    console.log(
      ">>> [DEBUG INJECTION] Hierarki dari ERP:",
      JSON.stringify(approverRows, null, 2),
    );

    if (!approverRows || approverRows.length === 0) {
      throw new Error(
        `Setup approval untuk ${standardizedKey} tidak ditemukan di ERP.`,
      );
    }

    try {
      console.log(
        `>>> [ERP SERVICE] 2. Local Vault: Storing draft for ${standardizedKey}...`,
      );
      await ApprovalDraft.create(
        {
          notrans,
          module_name: standardizedKey,
          target_id: String(targetId),
          action,
          payload,
          created_by: actorId,
          status: "Pending",
        },
        { transaction },
      );

      if (targetId && action !== "CREATE") {
        await model.update(
          { is_locked: true, lock_ticket: notrans },
          { where: { id: targetId }, transaction },
        );
      }
      console.log(`>>> [ERP SERVICE] 3. Injection: Registering to OWL...`);
      const cleanApproverRows = approverRows.map((row) => ({
        kodeapp: row.kodeapp,
        level: Number(row.level),
        karyawanid: String(row.karyawanid),
        jenispersetujuan: row.jenispersetujuan || CMS_CODE,
      }));

      const payloadTransAdd = {
        notrans,
        jenisApp: CMS_CODE,
        inputby: String(karyawanId || actorId),
        data: cleanApproverRows,
      };

      console.log(">>> [STRICT DEBUG] Menyiapkan Injeksi ke OWL");
      console.log(">>> Notrans:", notrans);
      console.log(
        ">>> Payload Data (Hierarki):",
        JSON.stringify(payloadTransAdd.data, null, 2),
      );

      await dawApi.post("/node/approval/trans/add", payloadTransAdd, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(
        `>>> [ERP SERVICE] 4. Success: Ticket ${notrans} is registered.`,
      );
      return { success: true, notrans };
    } catch (error) {
      console.error(
        `>>> [ERP SERVICE] ❌ FAILED at Ticket ${notrans}:`,
        error.message,
      );
      throw error;
    }
  }

  // GET Nomor Tiket (Untuk referensi)
  static async getApprovalNumber(token) {
    try {
      const response = await dawApi.post(
        "/node/tools/noapproval",
        { jenisApp: CMS_CODE },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return response.data.data;
    } catch (error) {
      this._handleError(error, "getApprovalNumber");
    }
  }

  // GET Queue List alias /trans/getData
  static async getPendingList({ karyawanid, token, limit = 100 }) {
    try {
      const payload = {
        approver: String(karyawanid),
        karyawanid: String(karyawanid),
        jenisApp: CMS_CODE,
        limit: Number(limit),
      };

      console.log(">>> [DEBUG OWL] Membuka Keran Data (getData)...");
      console.log(
        ">>> [DEBUG OWL] URL:",
        process.env.DAW_NODE_URL + "/node/approval/trans/getData",
      );
      console.log(">>> [DEBUG OWL] Payload:", JSON.stringify(payload));

      const response = await dawApi.post(
        "/node/approval/trans/getData",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data) {
        const rowCount = response.data.data?.rows?.length || 0;
        console.log(
          `>>> [DEBUG OWL] Response: ${response.data.message} | Rows Received: ${rowCount}`,
        );

        if (rowCount === 0 && response.data.error === false) {
          console.log(
            ">>> [DEBUG OWL] Info: OWL merespon sukses tapi tidak ada antrean aktif.",
          );
        }
      }
      return response.data;
    } catch (error) {
      console.error(
        "🚨 [DEBUG OWL ERROR]:",
        error.response?.data || error.message,
      );
      this._handleError(error, "getPendingList");
    }
  }

  // Execute Decision /trans/submitApp
  static async submitDecision({
    kodeapp,
    nourut,
    notrans,
    level,
    status,
    komentar,
    nextApp,
    token,
    karyawanid,
  }) {
    try {
      const payload = {
        status: String(status),
        kodeapp: kodeapp,
        notrans: notrans,
        level: Number(level),
        komentar: komentar || (status === "1" ? "Disetujui" : "Ditolak"),
        nextApp: String(nextApp),
        jenisApp: CMS_CODE,
        karyawanid: String(karyawanid),
      };
      const response = await dawApi.post(
        "/node/approval/trans/submitApp",
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log(
        ">>> [ERP RESPONSE RAW]:",
        JSON.stringify(response.data, null, 2),
      );
      return response.data;
    } catch (error) {
      this._handleError(error, "submitDecision");
    }
  }
}

module.exports = { ErpApprovalService, MODULE_REGISTRY };
