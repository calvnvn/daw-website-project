const axios = require("axios");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");
const { generateNotrans } = require("../utils/notransGenerator");

const CMS_CODE = process.env.CMS_APPROVAL_CODE
  ? process.env.CMS_APPROVAL_CODE.trim()
  : "CMS";

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

  // Handshake: Cek Setup
  static async _cekSetup(notrans, token) {
    try {
      const payload = {
        notrans: notrans,
        jenisApp: CMS_CODE,
      };

      console.log(`>>> [DEBUG OWL] Payload cekSetup:`, payload);

      const response = await dawApi.post(
        "/node/approval/setup/cekSetup",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return response.data?.data?.rows || [];
    } catch (error) {
      this._handleError(error, "cekSetup");
    }
  }

  // Initiate Approval (The Handshake Flow)
  // Alur: Vaulting -> Discovery -> Injection
  static async initiateApproval({
    model,
    targetId,
    action,
    payload,
    userId,
    owlUsername,
    token,
  }) {
    const t = await sequelize.transaction();

    try {
      // GENERATE notrans
      const notrans = generateNotrans(model.name);
      console.log(`>>> [LOCAL VAULT] Storing draft: ${notrans}`);

      // Save content to ApprovalDrafts Table (Status: Pending)
      await ApprovalDraft.create(
        {
          notrans: notrans,
          module_name: model.name,
          target_id: String(targetId),
          action: action,
          payload: payload,
          created_by: owlUsername || userId,
          status: "Pending",
        },
        { transaction: t },
      );

      // Locking Data Asli
      if (action !== "CREATE" && targetId) {
        await model.update(
          { is_locked: true, lock_ticket: notrans },
          { where: { id: targetId }, transaction: t },
        );
      }

      console.log(
        `>>> [HANDSHAKE] Discovery: Checking setup for ${notrans}...`,
      );
      const approverRows = await this._cekSetup(notrans, token);

      console.log(
        `>>> [HANDSHAKE] Injection: Registering transaction to OWL...`,
      );

      const inputByString = String(owlUsername || userId);
      const payloadTransAdd = {
        notrans: notrans,
        inputby: inputByString,
        data: approverRows,
      };

      console.log(
        `>>> [DEBUG OWL] Payload trans/add:`,
        JSON.stringify(payloadTransAdd, null, 2),
      );

      await dawApi.post("/node/approval/trans/add", payloadTransAdd, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await t.commit();
      console.log(
        `>>> [SUCCESS] Ticket ${notrans} is now live in OWL hierarchy.`,
      );

      return { success: true, notrans: notrans };
    } catch (error) {
      if (t) await t.rollback();
      this._handleError(error, "initiateApprovalInternal");
    }
  }

  // GET Nomor Tiket [GAKEPAKE TAPI BUAT JAGA JAGA]
  static async getApprovalNumber(token) {
    try {
      const response = await dawApi.post(
        "/node/tools/noapproval",
        { jenisApproval: CMS_CODE },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return response.data.data;
    } catch (error) {
      this._handleError(error, "getApprovalNumber");
    }
  }

  // GET Queue List for Admin (GET Pending)
  static async getPendingList(karyawanid, token) {
    try {
      const response = await dawApi.post(
        "/node/approval/trans/getData",
        {
          approver: karyawanid,
          jenisApproval: CMS_CODE,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
    } catch (error) {
      this._handleError(error, "getPendingList");
    }
  }

  // Execute Admin Decision (Approve/Reject)
  static async submitDecision(notrans, status, keterangan, token) {
    try {
      const response = await dawApi.post(
        "/node/approval/trans/submitApp",
        {
          notrans,
          status, // 1=Approve, 2=Reject
          keterangan: keterangan || "Processed via CMS",
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
    } catch (error) {
      this._handleError(error, "submitDecision");
    }
  }
}

module.exports = ErpApprovalService;
