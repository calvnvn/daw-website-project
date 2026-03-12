const InvestmentSetting = require("../models/InvestmentSettings");
const Affiliate = require("../models/Affiliate");
const fs = require("fs");
const path = require("path");

// 1. GET Data Investasi
exports.getInvestmentData = async (req, res) => {
  try {
    let settings = await InvestmentSetting.findOne();
    if (!settings)
      settings = await InvestmentSetting.create({
        teaserHeadline: "Other Investments.",
        teaserBody: "Beyond our core operations...",
        sectionIntro: "We continuously look for opportunities...",
      });

    const companies = await Affiliate.findAll({ order: [["id", "ASC"]] });
    res.status(200).json({ settings, companies });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. PUT Global Text
exports.updateSettings = async (req, res) => {
  try {
    const { teaserHeadline, teaserBody, sectionIntro } = req.body;
    let settings = await InvestmentSetting.findOne();
    if (!settings) settings = await InvestmentSetting.create({});

    await settings.update({ teaserHeadline, teaserBody, sectionIntro });
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. POST: Create Affiliate
exports.createAffiliate = async (req, res) => {
  try {
    const { name, desc, category } = req.body;
    const logoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const company = await Affiliate.create({ name, desc, category, logoUrl });
    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. PUT: Update Affiliate
exports.updateAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc, category, removePhoto } = req.body;

    const company = await Affiliate.findByPk(id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    let finalLogoUrl = company.logoUrl; // Gunakan kolom logoUrl sesuai model

    if (req.file) {
      // Hapus yang lama jika ada
      if (company.logoUrl) {
        const oldPath = path.join(__dirname, "..", "public", company.logoUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      finalLogoUrl = `/uploads/${req.file.filename}`; // Set file baru
    } else if (removePhoto === "true" && company.logoUrl) {
      const oldPath = path.join(__dirname, "..", "public", company.logoUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      finalLogoUrl = null;
    }

    await company.update({ name, desc, category, logoUrl: finalLogoUrl });

    res.status(200).json({ message: "Affiliate updated!", data: company });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. DELETE: Delete Affiliate
exports.deleteAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Affiliate.findByPk(id);

    if (!company) return res.status(404).json({ message: "Data not found" });

    if (company.logoUrl) {
      const photoPath = path.join(__dirname, "..", "public", company.logoUrl);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    await company.destroy();
    res
      .status(200)
      .json({ message: "Affiliate and logo deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
