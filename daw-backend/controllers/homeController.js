const HeroSlides = require("../models/HeroSlides");
const HomeSettings = require("../models/HomeSettings");
const ImpactStats = require("../models/ImpactStats");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");

const getRole = (req) =>
  req.userRole ? req.userRole.toLowerCase().trim() : "";
// GET Data di HomePage
exports.getHomepageData = async (req, res) => {
  try {
    const [slides, stats, settings] = await Promise.all([
      HeroSlides.findAll({ order: [["order", "ASC"]] }),
      ImpactStats.findAll({ order: [["order", "ASC"]] }),
      HomeSettings.findByPk(1),
    ]);

    let currentSettings = settings;
    if (!currentSettings) {
      currentSettings = await HomeSettings.create({
        id: 1,
        introHeadline: "A Transformation Company.",
        introBody: "Welcome to DAW.",
      });
    }

    res.status(200).json({ slides, stats, settings: currentSettings });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil data beranda", error: error.message });
  }
};

// SETTINGS Intro Text
exports.updateSettings = async (req, res) => {
  try {
    const userRole = getRole(req);
    const { introHeadline, introBody, status, previous_notrans } = req.body;

    let settings = await HomeSettings.findByPk(1);
    if (!settings) settings = await HomeSettings.create({ id: 1 });

    if (userRole === "editor" && settings.is_locked) {
      return res.status(423).json({
        message: "Intro sedang dikunci oleh proses approval.",
        ticket: settings.lock_ticket,
      });
    }

    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: HomeSettings,
        targetId: 1,
        action: "UPDATE",
        payload: { introHeadline, introBody },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });
      await settings.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Revisi intro homepage dikirim ke OWL. Data dikunci.",
        ticket: result.notrans,
      });
    }

    await settings.update({
      introHeadline,
      introBody,
      is_locked: false,
      lock_ticket: null,
    });
    res.status(200).json({ message: "Intro updated!", data: settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Hero Slides
exports.createHeroSlide = async (req, res) => {
  try {
    const userRole = getRole(req);
    const { title, subtitle, order, status } = req.body;
    const imageUrl = req.file ? req.file.filename : null;
    const slideData = { title, subtitle, order, imageUrl };

    if (userRole === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: HeroSlides,
        targetId: null, // Data baru belum punya ID
        action: "CREATE",
        payload: slideData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });
      return res.status(202).json({
        message: "Permintaan slide baru dikirim.",
        ticket: result.notrans,
      });
    }

    const slide = await HeroSlides.create(slideData);
    res.status(201).json(slide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateHeroSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = getRole(req);
    const { title, subtitle, order, status, previous_notrans } = req.body;

    const slide = await HeroSlides.findByPk(id);
    if (!slide) return res.status(404).json({ message: "Slide not found" });

    // 🛡️ GATEKEEPER: Cek Gembok Baris
    if (userRole === "editor" && slide.is_locked) {
      return res.status(423).json({
        message: "Slide ini sedang dikunci.",
        ticket: slide.lock_ticket,
      });
    }

    let newImageUrl = slide.imageUrl;
    let oldImageToDelete = null;

    if (req.file) {
      oldImageToDelete = slide.imageUrl;
      newImageUrl = req.file.filename; // Akan diawali TEMP_ oleh multer jika editor
    }

    const updatedData = { title, subtitle, order, imageUrl: newImageUrl };

    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: HeroSlides,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      // 🛡️ LOCK LOCAL DATA
      await slide.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Revisi slide dikirim ke OWL.",
        ticket: result.notrans,
      });
    }

    // Jalur Superadmin
    if (oldImageToDelete) deleteSingleFile(oldImageToDelete);
    await slide.update({ ...updatedData, is_locked: false, lock_ticket: null });
    res.status(200).json(slide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteHeroSlide = async (req, res) => {
  try {
    const userRole = getRole(req);
    const slide = await HeroSlides.findByPk(req.params.id);
    if (!slide) return res.status(404).json({ message: "Slide not found" });

    // 🛡️ GATEKEEPER: Gak bisa dihapus kalau lagi diajuin update-nya
    if (userRole === "editor" && slide.is_locked) {
      return res.status(423).json({
        message: "Gagal menghapus. Slide sedang terkunci.",
        ticket: slide.lock_ticket,
      });
    }

    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: HeroSlides,
        targetId: slide.id,
        action: "DELETE",
        payload: { title: slide.title }, // Payload dummy untuk modal info
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      // 🛡️ LOCK LOCAL DATA (Kunci biar gak diedit orang lain pas nunggu dihapus)
      await slide.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Permintaan hapus slide dikirim ke OWL.",
        ticket: result.notrans,
      });
    }

    if (slide.imageUrl) deleteSingleFile(slide.imageUrl);
    await slide.destroy();
    res.status(200).json({ message: "Slide deleted!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// 4. IMPACT STATS (Granular Row Lock)
// ==========================================
exports.createStat = async (req, res) => {
  try {
    const userRole = getRole(req);
    const count = await ImpactStats.count();
    if (count >= 4)
      return res.status(400).json({ message: "Maksimal hanya 4 statistik!" });

    const { icon, value, label, desc, order, status } = req.body;
    const statData = { icon, value, label, desc, order };

    if (userRole === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: ImpactStats,
        targetId: null,
        action: "CREATE",
        payload: statData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });
      return res.status(202).json({
        message: "Permintaan statistik baru dikirim.",
        ticket: result.notrans,
      });
    }

    const stat = await ImpactStats.create(statData);
    res.status(201).json(stat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStat = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = getRole(req);
    const { icon, value, label, desc, order, status, previous_notrans } =
      req.body;

    const stat = await ImpactStats.findByPk(id);
    if (!stat) return res.status(404).json({ message: "Stat not found" });

    if (userRole === "editor" && stat.is_locked) {
      return res.status(423).json({
        message: "Statistik ini sedang dikunci.",
        ticket: stat.lock_ticket,
      });
    }

    const statData = { icon, value, label, desc, order };

    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: ImpactStats,
        targetId: id,
        action: "UPDATE",
        payload: statData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      await stat.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Revisi statistik dikirim ke OWL.",
        ticket: result.notrans,
      });
    }

    await stat.update({ ...statData, is_locked: false, lock_ticket: null });
    res.status(200).json(stat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStat = async (req, res) => {
  try {
    const userRole = getRole(req);
    const stat = await ImpactStats.findByPk(req.params.id);
    if (!stat) return res.status(404).json({ message: "Stat not found" });

    if (userRole === "editor" && stat.is_locked) {
      return res.status(423).json({
        message: "Gagal menghapus. Data terkunci.",
        ticket: stat.lock_ticket,
      });
    }

    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: ImpactStats,
        targetId: stat.id,
        action: "DELETE",
        payload: { label: stat.label },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1],
      });

      await stat.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Permintaan hapus statistik dikirim.",
        ticket: result.notrans,
      });
    }

    await stat.destroy();
    res.status(200).json({ message: "Stat deleted!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
