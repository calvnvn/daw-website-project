const HeroSlide = require("../models/HeroSlide");
const HomeSetting = require("../models/HomeSetting");
const ImpactStat = require("../models/ImpactStat");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");

// GET Data di HomePage
exports.getHomepageData = async (req, res) => {
  try {
    const [slides, stats, settings] = await Promise.all([
      HeroSlide.findAll({ order: [["order", "ASC"]] }),
      ImpactStat.findAll({ order: [["order", "ASC"]] }),
      HomeSetting.findOne(),
    ]);

    let currentSettings = settings;
    if (!currentSettings) {
      currentSettings = await HomeSetting.create({
        introHeadline: "A Transformation Company.",
        introBody: "Welcome to DAW.",
      });
    }

    res.status(200).json({
      slides,
      stats,
      settings: currentSettings,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil data beranda", error: error.message });
  }
};

// SETTINGS Intro Text
exports.updateSettings = async (req, res) => {
  try {
    const { introHeadline, introBody, status } = req.body;
    let settings = await HomeSetting.findOne();
    if (!settings) settings = await HomeSetting.create({});

    // Editor Flow Request Update
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: HomeSetting,
        targetId: settings.id,
        action: "UPDATE",
        payload: { introHeadline, introBody },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Revisi intro homepage dikirim ke OWL.", ticket: result.notrans });
    }

    // Superadmin Flow
    await settings.update({ introHeadline, introBody, is_locked: false, lock_ticket: null });
    res.status(200).json({ message: "Intro updated!", data: settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Hero Slides 
exports.createHeroSlide = async (req, res) => {
  try {
    const { title, subtitle, order, status } = req.body;
    const imageUrl = req.file ? req.file.filename : null;
    const slideData = { title, subtitle, order, imageUrl };

    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: HeroSlide,
        targetId: null,
        action: "CREATE",
        payload: slideData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Permintaan slide baru dikirim ke OWL.", ticket: result.notrans });
    }

    const slide = await HeroSlide.create(slideData);
    res.status(201).json(slide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateHeroSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, order, status } = req.body;
    const slide = await HeroSlide.findByPk(id);
    if (!slide) return res.status(404).json({ message: "Slide not found" });

    let newImageUrl = slide.imageUrl;
    let oldImageToDelete = null;

    if (req.file) {
      oldImageToDelete = slide.imageUrl;
      newImageUrl = req.file.filename; // TEMP_ jika Editor
    }

    const updatedData = { title, subtitle, order, imageUrl: newImageUrl };

    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: HeroSlide,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Revisi slide dikirim ke OWL.", ticket: result.notrans });
    }

    if (oldImageToDelete && req.userRole?.toLowerCase() !== "editor") deleteSingleFile(oldImageToDelete);
    await slide.update({ ...updatedData, is_locked: false, lock_ticket: null });
    res.status(200).json(slide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteHeroSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findByPk(req.params.id);
    if (!slide) return res.status(404).json({ message: "Slide not found" });

    if (req.userRole?.toLowerCase() === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: HeroSlide,
        targetId: slide.id,
        action: "DELETE",
        payload: { title: slide.title },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Permintaan hapus slide dikirim ke OWL.", ticket: result.notrans });
    }

    if (slide.imageUrl) deleteSingleFile(slide.imageUrl);
    await slide.destroy();
    res.status(200).json({ message: "Slide deleted!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Impact Stats CRUD
exports.createStat = async (req, res) => {
  try {
    const count = await ImpactStat.count();
    if (count >= 4) return res.status(400).json({ message: "A maximum of 4 stats only!" });

    const { icon, value, label, desc, order, status } = req.body;
    const statData = { icon, value, label, desc, order };

    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: ImpactStat,
        targetId: null,
        action: "CREATE",
        payload: statData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Permintaan statistik baru dikirim ke OWL.", ticket: result.notrans });
    }

    const stat = await ImpactStat.create(statData);
    res.status(201).json(stat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStat = async (req, res) => {
  try {
    const { id } = req.params;
    const { icon, value, label, desc, order, status } = req.body;
    const stat = await ImpactStat.findByPk(id);
    if (!stat) return res.status(404).json({ message: "Stat not found" });

    const statData = { icon, value, label, desc, order };

    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        model: ImpactStat,
        targetId: id,
        action: "UPDATE",
        payload: statData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Revisi statistik dikirim ke OWL.", ticket: result.notrans });
    }

    await stat.update({ ...statData, is_locked: false, lock_ticket: null });
    res.status(200).json(stat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStat = async (req, res) => {
  try {
    const stat = await ImpactStat.findByPk(req.params.id);
    if (!stat) return res.status(404).json({ message: "Stat not found" });

    if (req.userRole?.toLowerCase() === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: ImpactStat,
        targetId: stat.id,
        action: "DELETE",
        payload: { label: stat.label },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.headers["authorization"]?.split(" ")[1]
      });
      return res.status(202).json({ message: "Permintaan hapus statistik dikirim ke OWL.", ticket: result.notrans });
    }

    await stat.destroy();
    res.status(200).json({ message: "Stat deleted!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};