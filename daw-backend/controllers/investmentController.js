const sequelize = require("../config/database");
const InvestmentSettings = require("../models/InvestmentSettings");
const Affiliate = require("../models/Affiliate");
const ApprovalDraft = require("../models/ApprovalDraft");
const { invalidateOldDrafts } = require("../utils/draftCleanup");
const { deleteSingleFile } = require("../utils/fileRemover");
const { generateNotrans } = require("../utils/notransGenerator");
const ErpApprovalService = require("../services/erpApprovalService");

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

exports.getPublicInvestmentData = async (req, res) => {
  try {
    let settings = await InvestmentSettings.findByPk(1);
    if (!settings) {
      try {
        settings = await InvestmentSettings.create({
          id: 1,
          teaserHeadline: "Other Investments.",
          teaserBody: "Beyond our core operations...",
          sectionIntro: "We continuously look for opportunities...",
          is_locked: false,
        });
      } catch (err) {
        settings = await InvestmentSettings.findByPk(1);
      }
    }

    const companies = await Affiliate.findAll({
      where: { is_locked: false },
      order: [["id", "ASC"]],
      attributes: ["id", "name", "desc", "category", "logoUrl", "websiteUrl"],
    });

    res.status(200).json({ settings, companies });
  } catch (error) {
    console.error("🚨 [GET_PUBLIC_INVESTMENT_ERROR]:", error.message);
    res.status(500).json({ message: "Gagal mengambil data publik investasi." });
  }
};

exports.getAdminInvestmentData = async (req, res) => {
  try {
    let settings = await InvestmentSettings.findByPk(1);
    if (!settings) {
      try {
        settings = await InvestmentSettings.create({
          id: 1,
          teaserHeadline: "Other Investments.",
          teaserBody: "Beyond our core operations...",
          sectionIntro: "We continuously look for opportunities...",
          is_locked: false,
        });
      } catch (err) {
        settings = await InvestmentSettings.findByPk(1);
      }
    }

    const companies = await Affiliate.findAll({
      attributes: {
        include: [
          [
            // 🔵 SENIOR FIX: Menambahkan COLLATE utf8mb4_unicode_ci
            // Memaksa hasil CAST memiliki "bahasa" yang sama dengan tabel ApprovalDrafts
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM ApprovalDrafts AS ad
              WHERE ad.target_id COLLATE utf8mb4_unicode_ci = CAST(Affiliate.id AS CHAR) COLLATE utf8mb4_unicode_ci
                AND ad.status COLLATE utf8mb4_unicode_ci = 'Rejected'
                AND ad.module_name COLLATE utf8mb4_unicode_ci = 'Affiliate'
            )`),
            "has_rejected_count",
          ],
        ],
      },
      order: [["id", "ASC"]],
    });

    const settingsDraft = await ApprovalDraft.count({
      where: {
        target_id: "1",
        module_name: "InvestmentSettings",
        status: "Rejected",
      },
    });

    const resultCompanies = companies.map((c) => {
      const data = c.get({ plain: true });
      data.has_rejected = data.has_rejected_count > 0;
      return data;
    });

    const resultSettings = settings.get({ plain: true });
    resultSettings.has_rejected = settingsDraft > 0;

    res
      .status(200)
      .json({ settings: resultSettings, companies: resultCompanies });
  } catch (error) {
    console.error("🚨 [GET_ADMIN_INVESTMENT_ERROR]:", error.message);
    res.status(500).json({ message: "Gagal mengambil data admin investasi." });
  }
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
    const actorId = String(req.owl_username || req.karyawanId);

    let settings = await InvestmentSettings.findByPk(1, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!settings) {
      settings = await InvestmentSettings.create({ id: 1 }, { transaction: t });
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

    // EDITOR (Approval Flow)
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans("INV_SET");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "InvestmentSettings",
          action: "UPDATE",
          target_id: "1",
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await settings.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          karyawanId: req.karyawanId,
          token: req.owl_token,
          moduleName: "InvestmentSettings",
        });
      } catch (erpError) {
        console.error(
          "⚠️ [ERP_SYNC_WARNING]: Gagal sinkronisasi ke ERP, namun draf lokal aman.",
          erpError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Revisi teks investasi berhasil diajukan.",
        ticket: notrans,
      });
    }

    // SUPERADMIN (Direct Override)
    await invalidateOldDrafts("InvestmentSettings", "1", t);

    await settings.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();
    res.status(200).json({
      success: true,
      message: "Pengaturan berhasil diperbarui secara langsung.",
      data: settings,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [UPDATE_SETTINGS_ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
// POST: Create Affiliate (Shared Transaction Standard)
exports.createAffiliate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userRole = req.userRole?.toLowerCase();
    const { status } = req.body;
    const actorId = String(req.owl_username || req.karyawanId);

    const { payload } = await processAffiliatePayload(req, {});

    // Buat data baseline di DB Lokal
    const isEditor = userRole === "editor";
    const newCompany = await Affiliate.create(
      { ...payload, is_locked: isEditor },
      { transaction: t },
    );

    // EDITOR (Approval Flow)
    if (isEditor && status === "Published") {
      const notrans = await generateNotrans("AFF");

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Affiliate",
          action: "CREATE",
          target_id: String(newCompany.id),
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await newCompany.update({ lock_ticket: notrans }, { transaction: t });

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: "Affiliate",
          karyawanId: req.karyawanId,
          token: req.owl_token,
          // HAPUS transaction: t dari parameter ini!
        });
      } catch (erpError) {
        console.error(
          "⚠️ [ERP_SYNC_WARNING]: Gagal sinkronisasi ERP saat Create Affiliate.",
          erpError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan tambah afiliasi baru diajukan.",
        ticket: notrans,
      });
    }

    // SUPERADMIN (Direct Execution)
    await t.commit();
    return res.status(201).json({
      success: true,
      message: "Affiliate berhasil dibuat secara permanen.",
      data: newCompany,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [CREATE_AFFILIATE_ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT: Update Affiliate (Shared Transaction Standard)
exports.updateAffiliate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const { status, previous_notrans } = req.body;
    const actorId = String(req.owl_username || req.karyawanId);

    const company = await Affiliate.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!company) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Perusahaan afiliasi tidak ditemukan",
      });
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

    const isDataChanged =
      payload.name !== company.name ||
      payload.desc !== company.desc ||
      payload.category !== company.category ||
      payload.websiteUrl !== company.websiteUrl ||
      filesToDelete.length > 0 ||
      req.file;

    if (!isDataChanged && userRole === "editor") {
      await t.rollback();
      return res.status(200).json({
        success: true,
        message: "Tidak ada perubahan data. Permintaan diabaikan.",
      });
    }

    // EDITOR (Approval Flow)
    if (userRole === "editor" && status === "Published") {
      const notrans = await generateNotrans("AFF");

      if (previous_notrans) {
        await ApprovalDraft.update(
          { status: "Replaced" },
          { where: { notrans: previous_notrans }, transaction: t },
        );
      }

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Affiliate",
          action: "UPDATE",
          target_id: String(id),
          payload: { ...payload, status: "Published" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await company.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: "Affiliate",
          karyawanId: req.karyawanId,
          token: req.owl_token,
        });
      } catch (erpError) {
        console.error(
          "⚠️ [ERP_SYNC_WARNING]: Gagal sinkronisasi ERP saat Update Affiliate.",
          erpError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Revisi afiliasi berhasil diajukan.",
        ticket: notrans,
      });
    }

    // SUPERADMIN (Direct Override)
    await invalidateOldDrafts("Affiliate", String(id), t);

    await company.update(
      { ...payload, is_locked: false, lock_ticket: null },
      { transaction: t },
    );

    await t.commit();

    // Hapus file LAMA setelah transaksi sukses 100%
    if (filesToDelete.length > 0) {
      filesToDelete.forEach((file) => deleteSingleFile(file));
    }

    res.status(200).json({
      success: true,
      message: "Affiliate berhasil diperbarui secara permanen!",
      data: company,
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [UPDATE_AFFILIATE_ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE: Delete Affiliate (Shared Transaction Standard)
exports.deleteAffiliate = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userRole = req.userRole?.toLowerCase();
    const actorId = String(req.owl_username || req.karyawanId);

    const company = await Affiliate.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!company) {
      await t.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Data tidak ditemukan" });
    }

    // 🚨 Lock Guard
    if (company.is_locked && userRole === "editor") {
      await t.rollback();
      return res.status(423).json({
        success: false,
        message:
          "Akses Dibatasi. Data ini sedang dikunci oleh proses approval ERP.",
        ticket: company.lock_ticket,
      });
    }

    const logoToDelete = company.logoUrl;

    // EDITOR (Approval Flow)
    if (userRole === "editor") {
      const notrans = await generateNotrans("AFF_DEL");

      const fullSnapshot = company.get({ plain: true });

      await ApprovalDraft.create(
        {
          notrans,
          module_name: "Affiliate",
          action: "DELETE",
          target_id: String(id),
          payload: { ...fullSnapshot, reason: "Request Delete" },
          created_by: actorId,
          status: "Pending",
        },
        { transaction: t },
      );

      await company.update(
        { is_locked: true, lock_ticket: notrans },
        { transaction: t },
      );

      await t.commit();

      try {
        await ErpApprovalService.initiateApproval({
          notrans,
          moduleName: "Affiliate",
          karyawanId: req.karyawanId,
          token: req.owl_token,
        });
      } catch (erpError) {
        console.error(
          "⚠️ [ERP_SYNC_WARNING]: Gagal sinkronisasi ERP saat Delete Affiliate.",
          erpError.message,
        );
      }

      return res.status(202).json({
        success: true,
        message: "Permintaan hapus afiliasi diajukan. Data dikunci sementara.",
        ticket: notrans,
      });
    }

    // SUPERADMIN (Direct Execution)
    await invalidateOldDrafts("Affiliate", String(id), t);
    await company.destroy({ transaction: t });

    await t.commit();

    if (logoToDelete) deleteSingleFile(logoToDelete.replace("/uploads/", ""));

    return res.status(200).json({
      success: true,
      message: "Affiliate beserta gambarnya berhasil dihapus secara permanen!",
    });
  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("🚨 [DELETE_AFFILIATE_ERROR]:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
