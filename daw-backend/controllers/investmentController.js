const InvestmentSetting = require("../models/InvestmentSettings");
const Affiliate = require("../models/Affiliate");
const { deleteSingleFile } = require("../utils/fileRemover");

const ErpApprovalService = require("../services/erpApprovalService");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE || "040101";

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
    const { teaserHeadline, teaserBody, sectionIntro, status } = req.body;
    let settings = await InvestmentSetting.findOne();
    if (!settings) settings = await InvestmentSetting.create({});

    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.headers["authorization"]?.spilt(" ")[1];

      const result = await ErpApprovalService.initiateApproval({
        model: InvestmentSetting,
        targetId: settings.id,
        action: "UPDATE",
        payload: { teaserHeadline, teaserBody, sectionIntro },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({ 
        message: "Revisi teks investasi dikirim ke OWL.", 
        ticket: result.notrans 
      });
    }

   // Superadmin Flow
    await settings.update({ teaserHeadline, teaserBody, sectionIntro, is_locked: false, lock_ticket: null });
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. POST: Create Affiliate (Approval Aware)
exports.createAffiliate = async (req, res) => {
  try {
    const { name, desc, category, websiteUrl, status } = req.body;
    const logoUrl = req.file ? req.file.filename : null;

    const affiliateData = { name, desc, category, websiteUrl, logoUrl };

    // --- JALUR EDITOR: REQUEST CREATE ---
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.headers["authorization"]?.split(" ")[1];
      
      const result = await ErpApprovalService.initiateApproval({
        model: Affiliate,
        targetId: null, // Karena data baru
        action: "CREATE",
        payload: affiliateData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({ 
        message: "Permintaan tambah afiliasi baru dikirim ke OWL.", 
        ticket: result.notrans 
      });
    }

    // --- JALUR SUPERADMIN ---
    const company = await Affiliate.create(affiliateData);
    res.status(201).json(company);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. PUT: Update Affiliate (Orchestrated)
exports.updateAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc, category, websiteUrl, removePhoto, status } = req.body;

    const company = await Affiliate.findByPk(id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    // Cek Gembok
    if (company.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({ message: "Data sedang dikunci oleh proses approval.", ticket: company.lock_ticket });
    }

    let finalLogoUrl = company.logoUrl;
    let oldLogoToDelete = null;

    if (req.file) {
      oldLogoToDelete = company.logoUrl;
      finalLogoUrl = req.file.filename; // Akan ada prefix TEMP_ jika via uploader editor
    } else if (removePhoto === "true") {
      oldLogoToDelete = company.logoUrl;
      finalLogoUrl = null;
    }

    const updatedData = {
      name: name || company.name,
      desc: desc || company.desc,
      category: category || company.category,
      websiteUrl: websiteUrl || company.websiteUrl,
      logoUrl: finalLogoUrl,
    };

    // --- JALUR EDITOR: REQUEST UPDATE ---
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.headers["authorization"]?.split(" ")[1];
      const result = await ErpApprovalService.initiateApproval({
        model: Affiliate,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({ message: "Revisi afiliasi dikirim ke OWL.", ticket: result.notrans });
    }

    // --- JALUR SUPERADMIN ---
    if (oldLogoToDelete) deleteSingleFile(oldLogoToDelete);
    await company.update({ ...updatedData, is_locked: false, lock_ticket: null });
    res.status(200).json({ message: "Affiliate updated!", data: company });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. DELETE: Delete Affiliate (Approval Aware)
exports.deleteAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Affiliate.findByPk(id);
    if (!company) return res.status(404).json({ message: "Data not found" });

    // --- JALUR EDITOR: REQUEST DELETE ---
    if (req.userRole?.toLowerCase() === "editor") {
      const tokenOWL = req.headers["authorization"]?.split(" ")[1];
      const result = await ErpApprovalService.initiateApproval({
        model: Affiliate,
        targetId: id,
        action: "DELETE",
        payload: { name: company.name }, // Info minimal untuk approver
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({ 
        message: "Permintaan hapus afiliasi dikirim ke OWL. Data dikunci.", 
        ticket: result.notrans 
      });
    }

    // --- JALUR SUPERADMIN ---
    if (company.logoUrl) deleteSingleFile(company.logoUrl);
    await company.destroy();
    res.status(200).json({ message: "Affiliate deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};