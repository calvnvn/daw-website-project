const managementService = require("../services/managementService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("LOCKED")) {
    const ticket = msg.split("tiket ")[1];
    return res.status(423).json({
      success: false,
      message: "Akses ditolak. Data sedang dikunci oleh proses approval OWL.",
      ticket,
    });
  }

  console.error(`🚨 [MANAGEMENT ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

const getRole = (req) => req.userRole ? req.userRole.toLowerCase().trim() : "";
const getActorId = (req) => String(req.owl_username || req.karyawanId || "").trim().toLowerCase();
const getToken = (req) => req.headers["authorization"]?.split(" ")[1] || req.owl_token;

exports.getAllManagements = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await managementService.getAllManagements(lang);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Gagal mengambil data management.");
  }
};

exports.createManagement = async (req, res) => {
  try {
    const result = await managementService.createManagement({
      userRole: getRole(req),
      body: req.body,
      file: req.file,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan tambah anggota direksi/manajemen dikirim.",
        ticket: result.ticket,
      });
    }

    res.status(201).json({ success: true, message: "Anggota berhasil ditambahkan secara live!", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat management.");
  }
};

exports.updateManagement = async (req, res) => {
  try {
    const result = await managementService.updateManagement({
      id: req.params.id,
      userRole: getRole(req),
      body: req.body,
      file: req.file,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Draf revisi manajemen dikirim.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({ success: true, message: "Data manajemen berhasil diperbarui!" });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui management.");
  }
};

exports.deleteManagement = async (req, res) => {
  try {
    const result = await managementService.deleteManagement({
      id: req.params.id,
      userRole: getRole(req),
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan hapus dikirim. Data dikunci.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({ success: true, message: "Data berhasil dihapus secara permanen." });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus management.");
  }
};
