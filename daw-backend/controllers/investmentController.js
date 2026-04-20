const InvestmentSettings = require("../models/InvestmentSettings");
const Affiliate = require("../models/Affiliate");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const sequelize = require("../config/database");

const ErpApprovalService = require("../services/erpApprovalService");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// 1. GET Data Investasi
exports.getInvestmentData = async (req, res) => {
  try {
    let settings = await InvestmentSettings.findOne();
    if (!settings)
      settings = await InvestmentSettings.create({
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
    const {
      teaserHeadline,
      teaserBody,
      sectionIntro,
      status,
      previous_notrans,
    } = req.body;
    let settings = await InvestmentSettings.findOne();
    if (!settings) settings = await InvestmentSettings.create({});

    if (settings.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({
        message: "Pengaturan Investasi sedang dikunci oleh proses approval.",
        ticket: settings.lock_ticket,
      });
    }

    // Editor
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: InvestmentSettings,
        targetId: 1,
        action: "UPDATE",
        payload: { teaserHeadline, teaserBody, sectionIntro },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      await settings.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Revisi teks investasi dikirim .",
        ticket: result.notrans,
      });
    }

    // Superadmin Flow
    await settings.update({
      teaserHeadline,
      teaserBody,
      sectionIntro,
      is_locked: false,
      lock_ticket: null,
    });
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. POST: Create Affiliate (Approval Aware)
exports.createAffiliate = async (req, res) => {
  let newCompany = null;
  try {
    const { name, desc, category, websiteUrl, status, previous_notrans } =
      req.body;
    const logoUrl = req.file ? req.file.filename : null;

    const affiliateData = {
      name,
      desc,
      category,
      websiteUrl,
      logoUrl,
      is_locked: false,
    };

    const t = await sequelize.transaction();
    try {
      newCompany = await Affiliate.create(affiliateData, { transaction: t });
      await t.commit();
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }

    // Editor
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      try {
        if (previous_notrans) {
          await ApprovalDraft.update(
            { status: "Replaced" },
            { where: { notrans: previous_notrans } },
          );
        }

        const result = await ErpApprovalService.initiateApproval({
          model: Affiliate,
          targetId: newCompany.id,
          action: "CREATE",
          payload: affiliateData,
          userId: req.userId,
          owlUsername: req.owl_username,
          token: req.owl_token,
        });

        await newCompany.update({
          is_locked: true,
          lock_ticket: result.notrans,
        });
        return res.status(202).json({
          message: "Permintaan tambah afiliasi baru dikirim.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        // 🛡️ BLUEPRINT: Orphan Guard
        console.error(
          `🚨 [CLEANUP] Menghapus orphan Affiliate ID: ${newCompany.id}`,
        );
        await newCompany.destroy();
        throw owlError;
      }
    }
    // Superadmin
    res.status(201).json({ message: "Affiliate created", data: newCompany });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. PUT: Update Affiliate (Orchestrated)
exports.updateAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      desc,
      category,
      websiteUrl,
      removePhoto,
      status,
      previous_notrans,
    } = req.body;

    const company = await Affiliate.findByPk(id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    // Cek Gembok
    if (company.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({
        message: "Data sedang dikunci oleh proses approval.",
        ticket: company.lock_ticket,
      });
    }

    let finalLogoUrl = company.logoUrl;
    let oldLogoToDelete = null;

    if (req.file) {
      oldLogoToDelete = company.logoUrl;
      finalLogoUrl = req.file.filename;
    } else if (removePhoto === "true") {
      oldLogoToDelete = company.logoUrl;
      finalLogoUrl = null;
    }

    const updatedData = {
      name: name || company.name,
      desc: desc || company.desc,
      category: category || company.category,
      websiteUrl: websiteUrl !== undefined ? websiteUrl : company.websiteUrl,
      logoUrl: finalLogoUrl,
    };

    // Editor
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: Affiliate,
        targetId: id,
        action: "UPDATE",
        payload: updatedData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      // 🛡️ BLUEPRINT: Lock Data!
      await company.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Revisi afiliasi dikirim .",
        ticket: result.notrans,
      });
    }

    // Superadmin
    if (oldLogoToDelete) deleteSingleFile(oldLogoToDelete);
    await company.update({
      ...updatedData,
      is_locked: false,
      lock_ticket: null,
    });
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

    // 🛡️ BLUEPRINT: Check Lock
    if (company.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({
        message: "Data sedang dikunci oleh proses approval.",
        ticket: company.lock_ticket,
      });
    }

    // --- JALUR EDITOR ---
    if (req.userRole?.toLowerCase() === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        model: Affiliate,
        targetId: id,
        action: "DELETE",
        payload: { name: company.name },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      // 🛡️ BLUEPRINT: Wajib Lock lokal!
      await company.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        message: "Permintaan hapus afiliasi dikirim . Data dikunci.",
        ticket: result.notrans,
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
