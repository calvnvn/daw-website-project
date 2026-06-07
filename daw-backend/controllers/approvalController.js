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

    const { page, limit, tab = "all", search = "" } = req.query;
    
    let data = await approvalService.getPendingApprovals(userRole, karyawanIdForOwl, tokenOWL);
    
    // SERVER-SIDE DERIVED PIPELINE
    const isSuperadmin = userRole === "superadmin" || userRole === "admin";

    // 1. FILTER
    let filteredData = data.filter((d) => {
      if (tab === "my_queue") return d.isMyQueue;
      if (tab === "history") return d.owlStatus === "1" || d.owlStatus === "2";
      if (tab === "all" && isSuperadmin) return true;
      return d.isMyQueue;
    });

    if (search.trim()) {
      const lowerQuery = search.toLowerCase();
      filteredData = filteredData.filter((d) => 
        (d.notrans && d.notrans.toLowerCase().includes(lowerQuery)) ||
        (d.module_name && d.module_name.toLowerCase().includes(lowerQuery)) ||
        (d.created_by && d.created_by.toLowerCase().includes(lowerQuery))
      );
    }

    // 2. SORT
    const now = new Date().getTime();
    filteredData.sort((a, b) => {
      if (a._isGhost !== b._isGhost) return a._isGhost ? 1 : -1;
      if (a.action === "DELETE" && b.action !== "DELETE") return -1;
      if (b.action === "DELETE" && a.action !== "DELETE") return 1;

      const aAge = now - new Date(a.createdAt || now).getTime();
      const bAge = now - new Date(b.createdAt || now).getTime();
      const aIsAging = aAge > 3 * 24 * 60 * 60 * 1000;
      const bIsAging = bAge > 3 * 24 * 60 * 60 * 1000;
      if (aIsAging !== bIsAging) return aIsAging ? -1 : 1;

      return new Date(b.createdAt || now).getTime() - new Date(a.createdAt || now).getTime();
    });

    // 3. STATS
    let urgent = 0, aging = 0, ghosts = 0, myTurn = 0;
    data.forEach((d) => {
      if (d.action === "DELETE") urgent++;
      if (d._isGhost) ghosts++;
      if (d.isMyQueue) myTurn++;
      const draftDate = new Date(d.createdAt || now).getTime();
      if (now - draftDate > 3 * 24 * 60 * 60 * 1000) aging++;
    });

    const stats = { total: data.length, urgent, aging, ghosts, myTurn };

    // 4. PAGINATION
    if (page && limit) {
      const totalItems = filteredData.length;
      const totalPages = Math.ceil(totalItems / limit) || 1;
      const startIndex = (parseInt(page) - 1) * parseInt(limit);
      const paginatedData = filteredData.slice(startIndex, startIndex + parseInt(limit));
      
      return res.status(200).json({
        data: paginatedData,
        totalItems,
        totalPages,
        stats
      });
    }

    // LEGACY FALLBACK (Jika frontend belum update)
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
