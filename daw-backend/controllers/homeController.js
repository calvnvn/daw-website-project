const HeroSlide = require("../models/HeroSlide");
const HomeSetting = require("../models/HomeSetting");
const ImpactStat = require("../models/ImpactStat");
const fs = require("fs");
const path = require("path");

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
    const { introHeadline, introBody } = req.body;
    let settings = await HomeSetting.findOne();
    if (!settings) settings = await HomeSetting.create({});

    await settings.update({ introHeadline, introBody });
    res.status(200).json({ message: "Intro updated!", data: settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Hero Slides CRUD
exports.createHeroSlide = async (req, res) => {
  try {
    const { title, subtitle, order } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const slide = await HeroSlide.create({ title, subtitle, order, imageUrl });
    res.status(201).json(slide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateHeroSlide = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, order } = req.body;
    const slide = await HeroSlide.findByPk(id);

    if (!slide) return res.status(404).json({ message: "Slide not found" });

    let newImageUrl = slide.imageUrl;
    // Jika admin upload gambar baru
    if (req.file) {
      // Hapus gambar lama dari folder public/uploads
      if (slide.imageUrl) {
        const oldPath = path.join(__dirname, "..", "public", slide.imageUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      newImageUrl = `/uploads/${req.file.filename}`;
    }

    await slide.update({ title, subtitle, order, imageUrl: newImageUrl });
    res.status(200).json(slide);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteHeroSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findByPk(req.params.id);
    if (!slide) return res.status(404).json({ message: "Slide not found" });

    if (slide.imageUrl) {
      const oldPath = path.join(__dirname, "..", "public", slide.imageUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await slide.destroy();
    res.status(200).json({ message: "Slide deleted!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Impact Stats CRUD
exports.createStat = async (req, res) => {
  try {
    // CEK JUMLAH STATS DULU (Backend Validation)
    const count = await ImpactStat.count();
    if (count >= 4) {
      return res.status(400).json({ message: "A maximum of 4 stats only!" });
    }

    const { icon, value, label, desc, order } = req.body;
    const stat = await ImpactStat.create({ icon, value, label, desc, order });
    res.status(201).json(stat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStat = async (req, res) => {
  try {
    const { id } = req.params;
    const { icon, value, label, desc, order } = req.body;
    const stat = await ImpactStat.findByPk(id);

    if (!stat) return res.status(404).json({ message: "Stat not found" });

    await stat.update({ icon, value, label, desc, order });
    res.status(200).json(stat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStat = async (req, res) => {
  try {
    const stat = await ImpactStat.findByPk(req.params.id);
    if (!stat) return res.status(404).json({ message: "Stat not found" });

    await stat.destroy();
    res.status(200).json({ message: "Stat deleted!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
