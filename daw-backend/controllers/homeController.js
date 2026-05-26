const homeService = require("../services/homeService");

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
      message: "Data sedang dalam proses peninjauan (Locked).",
      ticket,
    });
  }

  console.error(`🚨 [HOME ERROR]:`, msg);
  res.status(500).json({ success: false, message: defaultMsg || msg });
};

const getRole = (req) => req.userRole ? req.userRole.toLowerCase().trim() : "";
const getActorId = (req) => String(req.owl_username || req.karyawanId || "").trim().toLowerCase();
const getToken = (req) => req.headers["authorization"]?.split(" ")[1] || req.owl_token;

exports.getPublicHomepageData = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const data = await homeService.getPublicHomepageData(lang);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat data publik beranda.");
  }
};

exports.getAdminHomepageData = async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const actorId = getActorId(req);
    const data = await homeService.getAdminHomepageData(actorId, lang);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memuat data admin beranda.");
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const result = await homeService.updateSettings({
      userRole: getRole(req),
      body: req.body,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Revisi sambutan beranda diajukan ke ERP OWL.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({
      success: true,
      message: "Perubahan live berhasil disimpan secara instan!",
    });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui pengaturan beranda.");
  }
};

exports.createHeroSlide = async (req, res) => {
  try {
    const result = await homeService.createHeroSlide({
      userRole: getRole(req),
      body: req.body,
      file: req.file,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan slide baru diajukan.",
        ticket: result.ticket,
      });
    }

    res.status(201).json({ success: true, message: "Slide created live", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat slide.");
  }
};

exports.updateHeroSlide = async (req, res) => {
  try {
    const result = await homeService.updateHeroSlide({
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
        message: "Revisi slide berhasil diajukan ke ERP OWL.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({ success: true, message: "Slide updated live!", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui slide.");
  }
};

exports.deleteHeroSlide = async (req, res) => {
  try {
    const result = await homeService.deleteHeroSlide({
      id: req.params.id,
      userRole: getRole(req),
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan hapus slide diajukan. Data dikunci sementara.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({ success: true, message: "Slide deleted live!" });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus slide.");
  }
};

exports.createStat = async (req, res) => {
  try {
    const result = await homeService.createStat({
      userRole: getRole(req),
      body: req.body,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan statistik diajukan.",
        ticket: result.ticket,
      });
    }

    res.status(201).json({ success: true, message: "Stat created live", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal membuat statistik.");
  }
};

exports.updateStat = async (req, res) => {
  try {
    const result = await homeService.updateStat({
      id: req.params.id,
      userRole: getRole(req),
      body: req.body,
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Revisi statistik diajukan.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({ success: true, message: "Statistik updated live!", data: result.data });
  } catch (error) {
    handleServiceError(res, error, "Gagal memperbarui statistik.");
  }
};

exports.deleteStat = async (req, res) => {
  try {
    const result = await homeService.deleteStat({
      id: req.params.id,
      userRole: getRole(req),
      actorId: getActorId(req),
      owlToken: getToken(req),
    });

    if (result.isDraft) {
      return res.status(202).json({
        success: true,
        message: "Permintaan hapus statistik diajukan. Data dikunci sementara.",
        ticket: result.ticket,
      });
    }

    res.status(200).json({ success: true, message: "Statistik deleted live!" });
  } catch (error) {
    handleServiceError(res, error, "Gagal menghapus statistik.");
  }
};
