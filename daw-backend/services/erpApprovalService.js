const axios = require("axios");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");
const { generateNotrans } = require("../utils/notransGenerator");

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

  // Reference-Based Approval. Simpan konten di SQL, send nomor ke API DAW
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
      console.log(`>>> [APPROVAL] Generated Local Notrans: ${notrans}`);

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

      await dawApi.post(
        "/node/approval/trans/add",
        {
          notrans: notrans,
          jenisApproval: CMS_CODE,
          karyawanid: owlUsername || userId,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      await t.commit();
      console.log(
        `>>> [APPROVAL SUCCESS] Tiket ${notrans} berhasil didaftarkan.`,
      );

      return { success: true, notrans: notrans };
    } catch (error) {
      await t.rollback();
      this._handleError(error, "initiateApproval");
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
