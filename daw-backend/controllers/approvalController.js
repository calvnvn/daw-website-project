const approvalService = require("../services/approvalService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("FORBIDDEN")) {
    return res.status(403).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("VALIDATION")) {
    return res.status(400).json({ success: false, message: msg.split(": ")[1] });
  }

  console.error(`🚨 [APPROVAL ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

exports.getPendingApprovals = async (req, res) => {
  try {
    const userRole = req.userRole ? req.userRole.toLowerCase().trim() : "";
    const karyawanIdForOwl = String(req.karyawanId);
    const tokenOWL = req.owl_token;

    const data = await approvalService.getPendingApprovals(userRole, karyawanIdForOwl, tokenOWL);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat antrean persetujuan.");
  }
};

exports.executeDecision = async (req, res) => {
  try {
    const { status, notransaksi, level, komentar } = req.body;
    const notrans = req.body.notrans || notransaksi;

    const result = await approvalService.executeDecision({
      status,
      notrans,
      level,
      komentar,
      tokenOWL: req.owl_token,
      nikApprover: String(req.karyawanId),
    });

    res.status(200).json(result);
  } catch (error) {
    handleServiceError(res, error, "Gagal memproses keputusan.");
  }
};

exports.getOriginalData = async (req, res) => {
  try {
    const { module, targetId, action } = req.query;
    const data = await approvalService.getOriginalData(module, targetId, action);

    if (!data) {
      return res.status(200).json({
        _system_note: `Data Live tidak ditemukan. Pastikan data dengan ID ${targetId} belum dihapus dari database.`,
      });
    }

    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Terjadi kesalahan saat menarik data Live.");
  }
};

exports.getRejectedDraftByTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const { module } = req.query;

    if (!id || !module) {
      return res.status(400).json({ message: "Target ID dan Module Name wajib disertakan." });
    }

    const actorIds = [
      String(req.owl_username),
      String(req.karyawanId),
      String(req.userId)
    ].filter(v => v !== 'undefined' && v !== 'null');

    const result = await approvalService.getRejectedDraftByTarget({ id, module, actorIds });

    if (!result.hasRejected) {
      return res.status(200).json({
        message: "Tidak ada draf tertunda.",
        hasRejected: false,
      });
    }

    res.status(200).json({ success: true, hasRejected: true, data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil data pemulihan.");
  }
};

exports.discardDraft = async (req, res) => {
  try {
    const { notrans } = req.body;
    const currentUserIdentities = [
      req.owl_username ? String(req.owl_username) : null,
      req.karyawanId ? String(req.karyawanId) : null,
      req.userId ? String(req.userId) : null,
    ].filter(Boolean);

    const result = await approvalService.discardDraft({ notrans, currentUserIdentities });
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: "Notifikasi draf telah diabaikan.",
      });
    }
  } catch (error) {
    handleServiceError(res, error, "Gagal mengabaikan draf.");
  }
};

// exports.forcePurgeGhostTicket = async (req, res) => {
//   try {
//     const { notrans, nourut, level, komentar } = req.body;
//     await approvalService.forcePurgeGhostTicket({
//       notrans,
//       nourut,
//       level,
//       komentar,
//       tokenOWL: req.owl_token,
//       nikApprover: String(req.karyawanId),
//     });
// 
//     res.status(200).json({
//       success: true,
//       message: "Tiket yatim piatu berhasil dimusnahkan dari antrean ERP.",
//     });
//   } catch (error) {
//     handleServiceError(res, error, "Gagal membersihkan tiket dari ERP DAW.");
//   }
// };
