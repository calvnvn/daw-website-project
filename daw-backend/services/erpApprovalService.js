const axios = require("axios");

const CMS_CODE = process.env.CMS_APPROVAL_CODE;

const dawApi = axios.create({
  baseURL: process.env.DAW_NODE_URL,
  timeout: 15000,
});

class ErpApprovalService {
  static _handleError(error, context) {
    const status = error.response?.status || "NETWORK_ERROR";
    const data = error.response?.data || error.message;
    console.error(`[ERP ERROR - ${context}] Status: ${status}`, data);
    throw new Error(
      `ERP DAW Error (${context}): ${error.response?.data?.message || error.message}`,
    );
  }
  // GET Nomor Tiket (Queue)
  static async getApprovalNumber(jenisApproval, token) {
    try {
      console.log(">>> REQUESTING TICKET FOR:", jenisApproval);
      const response = await dawApi.post(
        "/tools/noapproval",
        { jenisApproval: CMS_CODE },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return response.data.data; // 'APP/2026/...'
    } catch (error) {
      this._handleError(error, "getApprovalNumber");
    }
  }

  // POST Draft Package to ERP (Add Transaction)
  static async createDraft(
    { karyawanid, module, action, targetId, content },
    token,
  ) {
    try {
      const notrans = await this.getApprovalNumber(token);

      const packageJSON = JSON.stringify({
        module, // ex: Project
        action, // ex: UPDATE
        targetId, // ex: "uuid-xxxx"
        content, // ex: { title: "Baru", ...}
      });

      // API Shoots to Add Transaction
      // Kalau ada field khusus dari API, ganti 'keterangan'
      const payload = {
        notrans: notrans,
        jenisApproval: jenisApproval,
        karyawanid: karyawanid,
        keterangan: packageJSON,
      };

      await dawApi.post("/approval/trans/add", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return {
        success: true,
        notrans: notrans,
        message: "Draf berhasil dikirim ke ERP DAW",
      };
    } catch (error) {
      this._handleError(error, "createDraft");
    }
  }

  // GET Queue List for Admin (GET Pending)
  static async getPendingList(karyawanid, jenisApproval, token) {
    try {
      const payload = {
        approver: karyawanid,
        jenisApproval: CMS_CODE,
      };

      const response = await dawApi.post("/approval/trans/getData", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      this._handleError(error, "getPendingList");
    }
  }

  // Execute Admin Decision (Approve/Reject)
  static async submitDecision(notrans, status, keterangan, token) {
    try {
      const payload = {
        notrans,
        status, // "1" = Approve, "2" = Reject
        keterangan: keterangan || "Processed via CMS",
      };

      const response = await dawApi.post("/approval/trans/submitApp", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data;
    } catch (error) {
      this._handleError(error, "submitDecision");
    }
  }
}

module.exports = ErpApprovalService;
