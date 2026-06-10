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

  // Helper: POST request with exponential backoff retry on database deadlock errors
  static async _postWithDeadlockRetry(url, payload, headers, maxRetries = 4) {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const response = await dawApi.post(url, payload, { headers });
        return response;
      } catch (error) {
        attempt++;
        const status = error.response?.status;
        const errMsg = error.response?.data?.message || "";
        const isDeadlock = (status === 500 && (errMsg.includes("Deadlock") || errMsg.includes("lock")));

        if (isDeadlock && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          console.warn(`⚠️ [ERP DEADLOCK DETECTED at ${url}] Retrying in ${delay.toFixed(0)}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
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



      const response = await this._postWithDeadlockRetry(
        "/node/approval/trans/add",
        payloadTransAdd,
        { Authorization: `Bearer ${token}` }
      );

      // --- [NEW LOGIC] TRIGGER EMAIL TO APPROVER 1 ---
      try {
        const firstApprover = cleanApproverRows.find(
          (row) => Number(row.level) === 1,
        );
        if (firstApprover) {
          const ApprovalDraft = require("../models/ApprovalDraft");
          const User = require("../models/User");
          const { sendApprovalNotification } = require("../utils/mailer");

          const draftData = await ApprovalDraft.findOne({
            where: { notrans: String(notrans) },
          });
          let targetUser = await User.findOne({
            where: { owl_username: firstApprover.karyawanid },
          });
          if (!targetUser && firstApprover.namakaryawan) {
            targetUser = await User.findOne({
              where: { name: firstApprover.namakaryawan.trim() },
            });
          }

          console.log(
            `[ERP COURIER] Ticket ${notrans} - Approver 1: ${firstApprover.namakaryawan || "-"} (${firstApprover.karyawanid}) | Local User DB: ${targetUser ? `Found (${targetUser.email})` : "Not Found"}`
          );

          if (draftData) {
            if (targetUser && targetUser.email) {
              await sendApprovalNotification({
                toEmail: targetUser.email,
                recipientName:
                  targetUser.name || firstApprover.namakaryawan || "Approver 1",
                type: "NEW_REQUEST",
                draftInfo: {
                  notrans: String(notrans),
                  module_name: draftData.module_name,
                  action: draftData.action,
                  created_by: draftData.created_by,
                },
              });
            } else {
              console.warn(
                `⚠️ [ERP COURIER] Email tidak dikirim karena user NIK ${firstApprover.karyawanid} (${firstApprover.namakaryawan || "Approver 1"}) tidak ditemukan di tabel Users lokal.`,
              );
            }
          }
        }
      } catch (mailError) {
        console.error(
          "🚨 [ERP COURIER] Gagal mengirim email ke Approver 1:",
          mailError.message,
        );
      }
      // ----------------------------------------------


      return {
        success: true,
        notrans,
        data: response.data,
        roadmap: cleanApproverRows,
      };
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



      const response = await dawApi.post(
        "/node/approval/trans/getData",
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data) {
        const rowCount = response.data.data?.rows?.length || 0;

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



      const response = await this._postWithDeadlockRetry(
        "/node/approval/trans/submitApp",
        payload,
        { Authorization: `Bearer ${token}` }
      );
      return response.data;
    } catch (error) {
      this._handleError(error, "submitDecision - /trans/submitApp");
    }
  }
}

module.exports = ErpApprovalService;
