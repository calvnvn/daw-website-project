const axios = require("axios");

const dawApi = axios.create({
  baseURL: process.env.DAW_NODE_URL,
  timeout: 15000,
});

class ErpApprovalService {
  // GET Nomor Tiket (Queue)
  static async getApprovalNumber(jenisApproval, token) {
    try {
      const response = await dawApi.post(
        "/tools/noapproval",
        { jenisApproval },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return response.data.data;
    } catch (error) {
      console.error(
        "[ERP API ERROR] Gagal getApprovalNumber: ",
        error.response?.data || error.message,
      );
      throw new Error("Gagal mendapatkan nomor tiket dari ERP DAW.");
    }
  }

  // POST Draft Package to ERP (Add Transaction)
  static async createDraft(
    { jenisApproval, karyawanid, module, action, targetId, content },
    token,
  ) {
    try {
      const notrans = await this.getApprovalNumber(jenisApproval, token);

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

      const response = await dawApi.post("/approval/trans/add", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return {
        success: true,
        notrans: notrans,
        message: "Draf berhasil dikirim ke ERP DAW",
      };
    } catch (error) {
      console.error(
        "[ERP API ERROR] Gagal createDraft:",
        error.response?.data || error.message,
      );
      throw new Error("Gagal mengirim draf revisi ke ERP DAW.");
    }
  }

  // GET Queue List for Admin (GET Pending)
  static async getPendingList(karyawanid, jenisApproval, token) {
    try {
      const payload = { approver: karyawanid };
      if (jenisApproval) {
        payload.jenisApproval = jenisApproval;
      }

      const response = await dawApi.post("/approval/trans/getData", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data;
    } catch (error) {
      console.error(
        "[ERP API ERROR] Gagal getPendingList:",
        error.response?.data || error.message,
      );
      throw new Error("Gagal mengambil daftar antrean dari ERP DAW.");
    }
  }

  // Execute Admin Decision (Approve/Reject)
  static async submitDecision(notrans, status, keterangan, token) {
    try {
      const payload = {
        notrans,
        status, // "1" = Approve, "2" = Reject
        keterangan,
      };

      const response = await dawApi.post("/approval/trans/submitApp", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data;
    } catch (error) {
      console.error(
        "[ERP API ERROR] Gagal submitDecision:",
        error.response?.data || error.message,
      );
      throw new Error(
        `Gagal memproses keputusan ${status === "1" ? "Approve" : "Reject"}.`,
      );
    }
  }
}

module.exports = ErpApprovalService;
