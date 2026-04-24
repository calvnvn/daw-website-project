const axios = require("axios");

const CMS_CODE = process.env.CMS_APPROVAL_CODE;

const dawApi = axios.create({
  baseURL: process.env.DAW_NODE_URL,
  timeout: 10000,
});

class ErpApprovalService {
  // Centralized Error Handling
  static _handleError(error, context) {
    const status = error.response?.status || "NETWORK_ERROR";
    const erpMessage = error.response?.data?.message || error.message;

    console.error(
      `🚨 [ERP COURIER ERROR - ${context}] Status: ${status}`,
      error.response?.data || error.message,
    );

    // Throwing error to Controller: Supaya bisa t.rollback() MySQL-nya
    const newError = new Error(`ERP DAW Error (${context}): ${erpMessage}`);
    newError.statusCode = status;
    newError.originalError = error;
    throw newError;
  }

  // FASE 1: Discovery (Cek Setup)
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

  // FASE 2: Inisiasi (Registration) - Pure API (POST /node/approval/trans/add)
  static async initiateApproval({ notrans, karyawanId, token }) {
    console.log(
      `>>> [ERP COURIER] 1. Discovery: Checking setup for ${notrans}...`,
    );
    const approverRows = await this._cekSetup(notrans, token);

    if (!approverRows || approverRows.length === 0) {
      throw new Error(
        `Setup approval untuk jenisApp '${CMS_CODE}' tidak ditemukan di ERP DAW.`,
      );
    }

    try {
      console.log(
        `>>> [ERP COURIER] 2. Injection: Registering ${notrans} to OWL...`,
      );

      const cleanApproverRows = approverRows.map((row) => ({
        kodeapp: String(row.kodeapp), // Menggunakan ID Blueprint saat ADD
        level: Number(row.level),
        karyawanid: String(row.karyawanid),
        jenispersetujuan: row.jenispersetujuan || CMS_CODE,
      }));

      const payloadTransAdd = {
        notrans: String(notrans),
        jenisApp: CMS_CODE,
        inputby: String(karyawanId),
        data: cleanApproverRows,
      };

      console.log(
        ">>> [STRICT DEBUG] Payload to /trans/add:",
        JSON.stringify(payloadTransAdd, null, 2),
      );

      const response = await dawApi.post(
        "/node/approval/trans/add",
        payloadTransAdd,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log(
        `>>> [ERP COURIER] ✅ Success: Ticket ${notrans} registered to ERP.`,
      );
      return { success: true, notrans, data: response.data };
    } catch (error) {
      this._handleError(error, "initiateApproval - /trans/add");
    }
  }

  // FASE 3: Listing Pending Approval (POST /node/approval/trans/getData)
  static async getPendingList({ karyawanid, token, limit = 100 }) {
    try {
      const payload = {
        approver: String(karyawanid),
        karyawanid: String(karyawanid),
        jenisApp: CMS_CODE,
        limit: Number(limit),
      };

      console.log(
        `>>> [ERP COURIER] Membuka Keran Data (getData) untuk NIK: ${karyawanid}...`,
      );

      const response = await dawApi.post(
        "/node/approval/trans/getData",
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data) {
        const rowCount = response.data.data?.rows?.length || 0;
        console.log(
          `>>> [ERP COURIER] Response: ${response.data.message} | Rows Received: ${rowCount}`,
        );
      }
      return response.data;
    } catch (error) {
      this._handleError(error, "getPendingList - /trans/getData");
    }
  }

  // FASE 4: Decision (POST /node/approval/trans/submitApp)
  static async submitDecision({
    nourut,
    notrans,
    level, // "Current Level + 1" DARI CONTROLLER
    status,
    komentar,
    nextApp, // NIK target atau String Kosong "" jika Final
    token,
    karyawanid,
  }) {
    try {
      const payload = {
        status: String(status),
        kodeapp: String(nourut),
        notrans: String(notrans),
        level: Number(level),
        komentar: komentar || (status === "1" ? "Disetujui" : "Ditolak"),
        nextApp: nextApp ? String(nextApp) : "",
        jenisApp: CMS_CODE,
        karyawanid: String(karyawanid),
      };

      console.log(
        ">>> [ERP COURIER PRE-FLIGHT] Submit Decision Payload:",
        JSON.stringify(payload, null, 2),
      );

      const response = await dawApi.post(
        "/node/approval/trans/submitApp",
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
    } catch (error) {
      this._handleError(error, "submitDecision - /trans/submitApp");
    }
  }
}

module.exports = ErpApprovalService;
