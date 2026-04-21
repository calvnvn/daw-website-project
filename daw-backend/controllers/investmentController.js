const InvestmentSettings = require("../models/InvestmentSettings");
const Affiliate = require("../models/Affiliate");
const ApprovalDraft = require("../models/ApprovalDraft");
const { deleteSingleFile } = require("../utils/fileRemover");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const sequelize = require("../config/database");

const ErpApprovalService = require("../services/erpApprovalService");
const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// 1. GET Data Investasi
exports.getInvestmentData = async (req, res) => {
  try {
    let settings = await InvestmentSettings.findOne();
    if (!settings) {
      settings = await InvestmentSettings.create({
        teaserHeadline: "Other Investments.",
        teaserBody: "Beyond our core operations...",
        sectionIntro: "We continuously look for opportunities...",
        is_locked: false,
      });
    }

    const companies = await Affiliate.findAll({
      order: [["id", "ASC"]],
      attributes: [
        "id",
        "name",
        "desc",
        "category",
        "logoUrl",
        "websiteUrl",
        "is_locked",
        "lock_ticket",
      ],
    });

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
        success: false,
        message:
          "Akses Dibatasi. Pengaturan Investasi sedang dikunci oleh proses approval.",
        ticket: settings.lock_ticket,
      });
    }

    // --- JALUR EDITOR (Two-Phase) ---
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      // Cleanup previous draft if resubmitting
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans } },
        );
      }

      const result = await ErpApprovalService.initiateApproval({
        model: InvestmentSettings,
        targetId: 1, // Singleton ID constraint
        action: "UPDATE",
        payload: { teaserHeadline, teaserBody, sectionIntro },
        userId: req.userId,
        owlUsername: req.owl_username,
        token: req.owl_token,
      });

      await settings.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        success: true,
        message: "Revisi teks investasi berhasil diajukan.",
        ticket: result.notrans,
      });
    }

    // --- JALUR SUPERADMIN (SOVEREIGN BYPASS) ---
    const t = await sequelize.transaction();
    try {
      // 1. The Atomic Draft Killer: Bunuh draf editor jika superadmin intervensi
      await invalidateOldDrafts("InvestmentSettings", 1, t);

      // 2. Override Live Data & Force Unlock
      await settings.update(
        {
          teaserHeadline,
          teaserBody,
          sectionIntro,
          is_locked: false,
          lock_ticket: null,
        },
        { transaction: t },
      );

      await t.commit();
      res.status(200).json({ success: true, data: settings });
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. POST: Create Affiliate (Approval Aware)
exports.createAffiliate = async (req, res) => {
  let newCompany = null;
  const userRole = req.userRole?.toLowerCase();

  try {
    const { name, desc, category, websiteUrl, status, previous_notrans } =
      req.body;

    // ⚠️ Catatan: Jika multer tidak diset untuk menambah prefix TEMP_ untuk role editor,
    // pastikan Orchestrator (approvalController) siap menerima format file ini.
    const logoUrl = req.file ? req.file.filename : null;

    const affiliateData = {
      name,
      desc,
      category,
      websiteUrl,
      logoUrl,
      is_locked: false,
    };

    // Phase 1: Local Transaction
    const t = await sequelize.transaction();
    try {
      if (userRole === "editor") affiliateData.is_locked = true; // Langsung lock jika editor
      newCompany = await Affiliate.create(affiliateData, { transaction: t });
      await t.commit();
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }

    // --- JALUR EDITOR (Phase 2) ---
    if (userRole === "editor" && status === "Published") {
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

        await newCompany.update({ lock_ticket: result.notrans });

        return res.status(202).json({
          success: true,
          message: "Permintaan tambah afiliasi baru diajukan.",
          ticket: result.notrans,
        });
      } catch (owlError) {
        console.error(
          `🚨 [CLEANUP] Menghapus orphan Affiliate ID: ${newCompany.id}`,
        );
        await newCompany.destroy();
        throw owlError;
      }
    }

    // --- JALUR SUPERADMIN ---
    res.status(201).json({
      success: true,
      message: "Affiliate created live",
      data: newCompany,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    if (!company)
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });

    // 🔒 THE GATEKEEPER
    if (company.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Data afiliasi ini sedang dikunci oleh proses approval.",
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

    // --- JALUR EDITOR ---
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

      await company.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        success: true,
        message: "Revisi afiliasi berhasil diajukan.",
        ticket: result.notrans,
      });
    }

    // --- JALUR SUPERADMIN (SOVEREIGN BYPASS) ---
    const t = await sequelize.transaction();
    try {
      // 1. The Atomic Draft Killer
      await invalidateOldDrafts("Affiliate", id, t);

      // 2. Lock & Update
      await company.update(
        { ...updatedData, is_locked: false, lock_ticket: null },
        { transaction: t },
      );

      await t.commit();

      // 3. Final Physical Asset Management (Hapus file lama SETELAH transaksi DB sukses)
      if (oldLogoToDelete) deleteSingleFile(oldLogoToDelete);

      res.status(200).json({
        success: true,
        message: "Affiliate updated live!",
        data: company,
      });
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. DELETE: Delete Affiliate (Approval Aware)
exports.deleteAffiliate = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Affiliate.findByPk(id);
    if (!company)
      return res
        .status(404)
        .json({ success: false, message: "Data not found" });

    // 🔒 THE GATEKEEPER
    if (company.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Data ini sedang dikunci oleh proses approval.",
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

      await company.update({ is_locked: true, lock_ticket: result.notrans });

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus afiliasi diajukan. Data dikunci.",
        ticket: result.notrans,
      });
    }

    // --- JALUR SUPERADMIN (SOVEREIGN BYPASS) ---
    const t = await sequelize.transaction();
    try {
      // 1. The Atomic Draft Killer
      await invalidateOldDrafts("Affiliate", id, t);

      // 2. Lock & Destroy
      await company.reload({ transaction: t, lock: t.LOCK.UPDATE });
      await company.destroy({ transaction: t });

      await t.commit();

      // 3. Final Physical Asset Management
      if (company.logoUrl) deleteSingleFile(company.logoUrl);

      res.status(200).json({
        success: true,
        message: "Affiliate deleted successfully live!",
      });
    } catch (dbError) {
      await t.rollback();
      throw dbError;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
