const businessService = require("../services/businessService");

const handleServiceError = (res, error, defaultMsg) => {
  const msg = error.message;

  if (msg.startsWith("NOT_FOUND")) {
    return res.status(404).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("VALIDATION_ERROR")) {
    return res.status(400).json({ success: false, message: msg.split(": ")[1] });
  }

  if (msg.startsWith("LOCKED")) {
    const ticket = msg.split("tiket ")[1];
    return res.status(423).json({
      success: false,
      message: "Akses Dibatasi. Sektor ini sedang dikunci oleh antrean approval.",
      ticket,
    });
  }

  console.error(`🚨 [BUSINESS ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

// ─── ADMIN ENDPOINTS ───

exports.getAdminBusinessSections = async (req, res) => {
  try {
    const data = await businessService.getAdminBusinessSections();
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch admin business data");
  }
};

exports.createBusinessSection = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await businessService.createBusinessSection({
      req, res,
      body: req.body,
      userRole: req.userRole,
      actorId,
      owlToken,
    });

    if (result.isDraft) {
      return res.status(202).json({
        message: "Pembuatan sektor diajukan. Sektor terkunci menunggu persetujuan.",
        ticket: result.ticket,
      });
    }

    res.status(201).json({
      message: "Sektor bisnis baru berhasil dibuat secara langsung.",
      data: result.data,
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal memproses pembuatan sektor");
  }
};

exports.updateBusinessSection = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await businessService.updateBusinessSection({
      req, res,
      id: req.params.id,
      body: req.body,
      userRole: req.userRole,
      actorId,
      owlToken,
    });

    if (!result) return; // Means handleEditorStaging intercepted and responded

    if (result.isHybridMapUpdate) {
      return res.status(200).json({
        success: true,
        message: "Koordinat titik lokasi berhasil diperbarui secara langsung!",
      });
    }

    res.status(200).json({
      message: "Sektor dan lokasi peta berhasil diperbarui secara permanen!",
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui sektor");
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const actorId = String(req.owl_username || req.karyawanId);
    const owlToken = req.headers["authorization"]?.split(" ")[1] || req.owl_token;

    const result = await businessService.deleteSection({
      req, res,
      id: req.params.id,
      userRole: req.userRole,
      actorId,
      owlToken,
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan hapus sektor dikirim ke Server. Data dikunci.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({ message: "Sektor berhasil dihapus secara permanen." });
  } catch (error) {
    handleServiceError(res, error, "Gagal memproses penghapusan");
  }
};

exports.uploadBusinessImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Tidak ada file yang diunggah" });
    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ success: true, url: imageUrl });
  } catch (error) {
    res.status(500).json({ message: "Gagal memproses gambar" });
  }
};

// ─── PUBLIC READ-ONLY ENDPOINTS ───

exports.getPublicBusinessData = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await businessService.getPublicBusinessData(lang);
    res.status(200).json(data);
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch business data");
  }
};
