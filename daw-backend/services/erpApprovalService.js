const axios = require("axios");

// Initialize application code and authenticated API instance
const CMS_CODE = process.env.CMS_APPROVAL_CODE;
const dawApi = axios.create({
  baseURL: process.env.DAW_NODE_URL,
  timeout: parseInt(process.env.ERP_API_TIMEOUT_MS) || 10000,
});

/**
 * Orchestrates technical integration between CMS and ERP Node workflows
 */
class ErpApprovalService {
  // Map external API errors to local exceptions for transaction rollbacks
  static _handleError(error, context) {
    const status = error.response?.status || "NETWORK_ERROR";
    const erpMessage = error.response?.data?.message || error.message;

    console.error(
      `🚨 [ERP COURIER ERROR - ${context}] Status: ${status}`,
      error.response?.data || error.message,
    );

    const newError = new Error(`ERP DAW Error (${context}): ${erpMessage}`);
    newError.statusCode = status;
    newError.originalError = error;
    throw newError;
  }

  // Validate approval configuration (POST /node/approval/setup/cekSetup)
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

  // Register transaction to ERP workflow (POST /node/approval/trans/add)
  static async initiateApproval({ notrans, karyawanId, token }) {
    const approverRows = await this._cekSetup(notrans, token);

    if (!approverRows || approverRows.length === 0) {
      throw new Error(
        `Setup approval untuk jenisApp '${CMS_CODE}' tidak ditemukan di ERP DAW.`,
      );
    }

    try {
      // Normalize approver data structure for ERP ingestion
      const cleanApproverRows = approverRows.map((row) => ({
        kodeapp: String(row.kodeapp),
        level: Number(row.level),
        karyawanid: String(row.karyawanid),
        jenispersetujuan: row.jenispersetujuan || CMS_CODE,
        namakaryawan: row.namakaryawan || "",
      }));

      const payloadTransAdd = {
        notrans: String(notrans),
        jenisApp: CMS_CODE,
        inputby: String(karyawanId),
        data: cleanApproverRows,
      };

      // console.log(
      //   ">>> [STRICT DEBUG] Payload to /trans/add:",
      //   JSON.stringify(payloadTransAdd, null, 2),
      // );

      const response = await dawApi.post(
        "/node/approval/trans/add",
        payloadTransAdd,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      // --- [NEW LOGIC] TRIGGER EMAIL TO APPROVER 1 ---
      try {
        const firstApprover = cleanApproverRows.find((row) => Number(row.level) === 1);
        if (firstApprover) {
          const ApprovalDraft = require("../models/ApprovalDraft");
          const User = require("../models/User");
          const { sendApprovalNotification } = require("../utils/mailer");

          const draftData = await ApprovalDraft.findOne({ where: { notrans: String(notrans) } });
          const targetUser = await User.findOne({ where: { owl_username: firstApprover.karyawanid } });

          console.log(`\n================ [ERP COURIER - APPROVER 1 DETECTED] ================`);
          console.log(`   👉 NIK Approver 1 : ${firstApprover.karyawanid}`);
          console.log(`   👉 Nama Approver 1: ${firstApprover.namakaryawan || "-"}`);
          console.log(`   👉 Target User DB : ${targetUser ? `Ditemukan (${targetUser.email})` : "TIDAK DITEMUKAN (Menggunakan Fallback)"}`);
          console.log(`======================================================================\n`);

          const toEmail = (targetUser && targetUser.email) ? targetUser.email : `${firstApprover.karyawanid}@daw.co.id`;
          const recipientName = (targetUser && targetUser.name) ? targetUser.name : (firstApprover.namakaryawan || "Approver 1");

          if (draftData) {
            await sendApprovalNotification({
              toEmail: toEmail,
              recipientName: recipientName,
              type: "NEW_REQUEST",
              draftInfo: {
                notrans: String(notrans),
                module_name: draftData.module_name,
                action: draftData.action,
                created_by: draftData.created_by,
              },
            });
          }
        }
      } catch (mailError) {
        console.error("🚨 [ERP COURIER] Gagal mengirim email ke Approver 1:", mailError.message);
      }
      // ----------------------------------------------

      // console.log(
      //   `>>> [ERP COURIER] ✅ Success: Ticket ${notrans} registered to ERP.`,
      // );
      return { success: true, notrans, data: response.data, roadmap: cleanApproverRows };
    } catch (error) {
      this._handleError(error, "initiateApproval - /trans/add");
    }
  }

  // Retrieve pending tasks for specific employee (POST /node/approval/trans/getData)
  static async getPendingList({ karyawanid, token, limit = 100 }) {
    try {
      const payload = {
        approver: String(karyawanid),
        karyawanid: String(karyawanid),
        jenisApp: CMS_CODE,
        limit: Number(limit),
      };

      // console.log(
      //   `>>> [ERP COURIER] Membuka Data (getData) untuk NIK: ${karyawanid}...`,
      // );

      const response = await dawApi.post(
        "/node/approval/trans/getData",
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data) {
        const rowCount = response.data.data?.rows?.length || 0;
        // console.log(
        //   `>>> [ERP COURIER] Response: ${response.data.message} | Rows Received: ${rowCount}`,
        // );
      }
      return response.data;
    } catch (error) {
      this._handleError(error, "getPendingList - /trans/getData");
    }
  }

  // Submit approval/rejection state update (POST /node/approval/trans/submitApp)
  static async submitDecision({
    nourut,
    notrans,
    level, // "Current Level + 1" from controller
    status,
    komentar,
    nextApp, // NIK target or empty string "" if there is no next approver
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

      // console.log(
      //   ">>> [ERP COURIER PRE-FLIGHT] Submit Decision Payload:",
      //   JSON.stringify(payload, null, 2),
      // );

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
