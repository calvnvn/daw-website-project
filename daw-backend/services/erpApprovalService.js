const axios = require("axios");
const ApprovalDraft = require("../models/ApprovalDraft");
const sequelize = require("../config/database");
const { generateNotrans } = require("../utils/notransGenerator");

const CMS_CODE = process.env.CMS_APPROVAL_CODE
  ? process.env.CMS_APPROVAL_CODE.trim()
  : "CMS";

if (!process.env.DAW_NODE_URL) {
  console.warn("⚠️ WARNING: DAW_NODE_URL environment variable is not set!");
}

const dawApi = axios.create({
  baseURL: process.env.DAW_NODE_URL,
  timeout: 10000,
});

class ErpApprovalService {
  static _handleError(error, context) {
    const status = error.response?.status || "NETWORK_ERROR";
    const erpMessage = error.response?.data?.message || error.message;

    // Log lengkap untuk keperluan debugging (jangan tampilkan ke user)
    console.error(
      `🚨 [ERP ERROR - ${context}] Status: ${status}`,
      error.response?.data || error.message,
    );

    // Custom error object yang mempertahankan stack trace (opsional tapi disarankan)
    const newError = new Error(`ERP DAW Error (${context}): ${erpMessage}`);
    newError.statusCode = status;
    newError.originalError = error; // Simpan error asli
    throw newError;
  }

  // Handshake: Cek Setup
  static async _cekSetup(notrans, token) {
    try {
      const response = await dawApi.post(
        "/node/approval/setup/cekSetup",
        { notrans, jenisApp: CMS_CODE },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return response.data?.data?.rows || [];
    } catch (error) {
      this._handleError(error, "cekSetup");
    }
  }

  // 🚀 REFACTORED: Initiate Approval (Saga Pattern / 2-Phase Commit)
  static async initiateApproval({
    model,
    targetId,
    action,
    payload,
    userId,
    owlUsername,
    token,
  }) {
    const notrans = generateNotrans(model.name);
    const actorId = String(owlUsername || userId);

    // 1. PRE-FLIGHT CHECK (Network Call di LUAR DB Transaction)
    console.log(`>>> [HANDSHAKE] Discovery: Checking setup for ${notrans}...`);
    const approverRows = await this._cekSetup(notrans, token);

    // Asumsi: Jika approver tidak ada, kita harus tolak sejak awal agar tidak jadi draf hantu
    if (!approverRows || approverRows.length === 0) {
      throw new Error(
        "Setup approval tidak ditemukan di ERP. Hubungi Administrator.",
      );
    }

    // 2. FAST DB TRANSACTION (Operasi database super cepat, tanpa tunggu network)
    console.log(`>>> [LOCAL VAULT] Storing draft: ${notrans}`);
    const t = await sequelize.transaction();
    try {
      await ApprovalDraft.create(
        {
          notrans,
          module_name: model.name,
          target_id: String(targetId),
          action,
          payload,
          created_by: actorId,
          status: "Pending", // Status awal
        },
        { transaction: t },
      );

      if (targetId && action !== "CREATE") {
        await model.update(
          { is_locked: true, lock_ticket: notrans },
          { where: { id: targetId }, transaction: t },
        );
      }
      await t.commit(); // DB TERTUTUP CEPAT! Performa aman.
    } catch (dbError) {
      await t.rollback();
      throw new Error(
        `Database Error: Gagal menyimpan draf lokal - ${dbError.message}`,
      );
    }

    // 3. POST-COMMIT SYNC (Lapor ERP)
    console.log(`>>> [HANDSHAKE] Injection: Registering transaction to OWL...`);
    try {
      const payloadTransAdd = {
        notrans,
        jenisApp: CMS_CODE, // 🚀 FIX: Ini WAJIB ada sesuai spec ERP DAW
        inputby: actorId,
        data: approverRows,
      };

      await dawApi.post("/node/approval/trans/add", payloadTransAdd, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(
        `>>> [SUCCESS] Ticket ${notrans} is now live in OWL hierarchy.`,
      );
      return { success: true, notrans };
    } catch (erpError) {
      // 🚀 COMPENSATING ACTION (Rollback Manual DB jika ERP gagal merespon)
      console.error(
        `🚨 ERP Sync Failed! Melakukan rollback data lokal untuk ${notrans}...`,
      );
      try {
        await ApprovalDraft.update(
          {
            status: "Rejected",
            rejection_reason: "Gagal sinkronisasi dengan server ERP.",
          },
          { where: { notrans } },
        );
        if (targetId && action !== "CREATE") {
          await model.update(
            { is_locked: false, lock_ticket: null },
            { where: { id: targetId } },
          );
        }
      } catch (rollbackErr) {
        console.error(
          "🚨 FATAL: Gagal melakukan compensating rollback!",
          rollbackErr,
        );
      }

      this._handleError(erpError, "initiateApproval (Injection Phase)");
    }
  }

  // GET Nomor Tiket (Untuk referensi)
  static async getApprovalNumber(token) {
    try {
      const response = await dawApi.post(
        "/node/tools/noapproval",
        { jenisApp: CMS_CODE }, // 🚀 FIX: Samakan key dengan yang lain
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return response.data.data;
    } catch (error) {
      this._handleError(error, "getApprovalNumber");
    }
  }

  // GET Queue List
  static async getPendingList(karyawanid, token) {
    try {
      const payload = {
        approver: String(karyawanid),
        karyawanid: String(karyawanid),
        jenisApp: CMS_CODE,
        jenispersetujuan: CMS_CODE,
      };

      console.log(
        ">>> [DEBUG OWL] Nembak ke URL:",
        process.env.DAW_NODE_URL + "/node/approval/trans/getData",
      );
      console.log(">>> [DEBUG OWL] Payload:", JSON.stringify(payload));

      const response = await dawApi.post(
        "/node/approval/trans/getData",
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // 🚩 CEK DISINI JAP!
      if (response.data) {
        console.log(
          ">>> [DEBUG OWL] Response Error Status:",
          response.data.error,
        );
        console.log(">>> [DEBUG OWL] Response Message:", response.data.message);
        console.log(
          ">>> [DEBUG OWL] Count Rows:",
          response.data.data?.rows?.length || 0,
        );

        // Jika rows 0, tapi ada data lain, kita harus tau
        // if (response.data.data?.rows?.length === 0) {
        //   console.log(
        //     ">>> [DEBUG OWL] Kenapa 0? Cek seluruh isi data:",
        //     JSON.stringify(response.data.data, null, 2),
        //   );
        // }
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

  // Execute Decision
  static async submitDecision(
    notransaksi,
    status,
    keterangan,
    token,
    karyawanid,
    nourut,
  ) {
    try {
      const payload = {
        notransaksi: notransaksi,
        nourut: nourut,
        status: String(status),
        keterangan: keterangan || "Processed via CMS",
        jenispersetujuan: "CMS",
        karyawanid: String(karyawanid),
      };

      console.log(">>> [DEBUG OWL] Payload:", JSON.stringify(payload, null, 2));

      const response = await dawApi.post(
        "/node/approval/trans/submitApp",
        payload,
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
