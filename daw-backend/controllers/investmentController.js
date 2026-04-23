const sequelize = require("../config/database");
const InvestmentSettings = require("../models/InvestmentSettings");
const Affiliate = require("../models/Affiliate");
const ApprovalDraft = require("../models/ApprovalDraft");
const { ErpApprovalService } = require("../services/erpApprovalService");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { deleteSingleFile } = require("../utils/fileRemover");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

// Helper: standarisasi teks global investasi
const processInvestmentPayload = async (req, existingData = {}) => {
  const { teaserHeadline, teaserBody, sectionIntro } = req.body;

  return {
    payload: {
      teaserHeadline: teaserHeadline || existingData.teaserHeadline,
      teaserBody: teaserBody || existingData.teaserBody,
      sectionIntro: sectionIntro || existingData.sectionIntro,
    },
    filesToDelete: [],
  };
};

// Helper 2: untuk menangani transformasi data Affiliates
const processAffiliatePayload = async (req, existingData = {}) => {
  const { name, desc, category, websiteUrl, removePhoto } = req.body;
  let filesToDelete = [];
  let finalLogoUrl = existingData.logoUrl || null;

  // 1. Logika Penggantian Logo (Multer)
  if (req.file) {
    // Jika ada logo baru, tandai logo lama untuk dihapus fisik nanti
    if (existingData.logoUrl) filesToDelete.push(existingData.logoUrl);
    finalLogoUrl = req.file.filename;
  }
  // 2. Logika Penghapusan Logo Manual
  else if (removePhoto === "true" || removePhoto === true) {
    if (existingData.logoUrl) filesToDelete.push(existingData.logoUrl);
    finalLogoUrl = null;
  }

  return {
    payload: {
      name: name || existingData.name,
      desc: desc || existingData.desc,
      category: category || existingData.category,
      websiteUrl:
        websiteUrl !== undefined ? websiteUrl : existingData.websiteUrl,
      logoUrl: finalLogoUrl,
    },
    filesToDelete,
  };
};

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

// 2. PUT Global Text (Shared Transaction Standard)
exports.updateSettings = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase();
    const { status, previous_notrans } = req.body;

    // Baca/Buat data di dalam transaksi
    let settings = await InvestmentSettings.findOne({ transaction: t });
    if (!settings) {
      settings = await InvestmentSettings.create({}, { transaction: t });
    }

    if (settings.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Pengaturan Investasi sedang dikunci oleh proses approval.",
        ticket: settings.lock_ticket,
      });
    }

    const { payload } = await processInvestmentPayload(req, settings);

    // JALUR EDITOR (Approval Flow)
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      // Shared Transaction ke ERP OWL
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "InvestmentSettings",
        model: InvestmentSettings,
        targetId: 1, // Singleton ID constraint
        action: "UPDATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      // Kunci data lokal
      await settings.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        success: true,
        message: "Revisi teks investasi berhasil diajukan.",
        ticket: result.notrans,
      });
    }

    //JALUR SUPERADMIN (Direct Override)
    await invalidateOldDrafts("InvestmentSettings", 1, t);

    await settings.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();
    res.status(200).json({
      success: true,
      message: "Pengaturan berhasil diperbarui.",
      data: settings,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [UPDATE_SETTINGS_ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. POST: Create Affiliate (Shared Transaction Standard)
exports.createAffiliate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase();
    const { status } = req.body;

    const { payload } = await processAffiliatePayload(req, {});

    // 1. Buat data base line di DB Lokal
    const isEditor = userRole === "editor";
    const newCompany = await Affiliate.create(
      { ...payload, is_locked: isEditor },
      { transaction: t },
    );

    // JALUR EDITOR (Approval Flow)
    if (isEditor && status === "Published") {
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Affiliate",
        model: Affiliate,
        targetId: newCompany.id,
        action: "CREATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      // Update tiket gembok lokal
      await newCompany.update(
        { lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        success: true,
        message: "Permintaan tambah afiliasi baru diajukan ke ERP.",
        ticket: result.notrans,
      });
    }

    // JALUR SUPERADMIN ATAU SAVE DRAFT
    await t.commit();
    return res.status(201).json({
      success: true,
      message: "Affiliate berhasil dibuat secara langsung.",
      data: newCompany,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [CREATE_AFFILIATE_ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. PUT: Update Affiliate (Shared Transaction Standard)
exports.updateAffiliate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const { status, previous_notrans } = req.body;

    const company = await Affiliate.findByPk(id, { transaction: t });
    if (!company) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }

    if (company.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Data afiliasi ini sedang dikunci oleh proses approval.",
        ticket: company.lock_ticket,
      });
    }

    const { payload, filesToDelete } = await processAffiliatePayload(
      req,
      company,
    );

    // JALUR EDITOR (Approval Flow)
    if (userRole === "editor" && status === "Published") {
      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      // Shared Transaction ke ERP OWL
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Affiliate",
        model: Affiliate,
        targetId: id,
        action: "UPDATE",
        payload: { ...payload, status: "Published" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await company.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        success: true,
        message: "Revisi afiliasi berhasil diajukan.",
        ticket: result.notrans,
      });
    }

    // JALUR SUPERADMIN (Direct Override)
    await invalidateOldDrafts("Affiliate", id, t);

    await company.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();

    if (filesToDelete.length > 0) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
    }

    res.status(200).json({
      success: true,
      message: "Affiliate updated live!",
      data: company,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [UPDATE_AFFILIATE_ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. DELETE: Delete Affiliate (Shared Transaction Standard)
exports.deleteAffiliate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();

    // 1. Ambil data dengan EXCLUSIVE LOCK (Mencegah Deadlock & Race Condition)
    const company = await Affiliate.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!company) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Data not found" });
    }

    if (company.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Data ini sedang dikunci oleh proses approval ERP.",
        ticket: company.lock_ticket,
      });
    }

    // Siapkan nama file untuk dihapus JIKA transaksi sukses
    const logoToDelete = company.logoUrl;

    // JALUR EDITOR (Approval Flow)
    if (userRole === "editor") {
      const result = await ErpApprovalService.initiateApproval({
        moduleName: "Affiliate",
        model: Affiliate,
        targetId: id,
        action: "DELETE",
        payload: { name: company.name, reason: "Request Delete" },
        userId: req.userId,
        owlUsername: req.owl_username,
        karyawanId: req.karyawanId,
        token: req.owl_token,
        transaction: t,
      });

      await company.update(
        { is_locked: true, lock_ticket: result.notrans },
        { transaction: t },
      );

      await t.commit();
      return res.status(202).json({
        success: true,
        message: "Permintaan hapus afiliasi diajukan. Data dikunci.",
        ticket: result.notrans,
      });
    }

    // JALUR SUPERADMIN (Direct Execution)
    await invalidateOldDrafts("Affiliate", id, t);
    await company.destroy({ transaction: t });
    await t.commit();

    // 4. Final Physical Asset Management
    if (logoToDelete) deleteSingleFile(logoToDelete);

    return res.status(200).json({
      success: true,
      message: "Affiliate berhasil dihapus secara permanen!",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [DELETE_AFFILIATE_ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
