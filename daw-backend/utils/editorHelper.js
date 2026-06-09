const { Op } = require("sequelize");
const sequelize = require("../config/database");
const ApprovalDraft = require("../models/ApprovalDraft");
const { generateNotrans } = require("./notransGenerator");
const ErpApprovalService = require("../services/erpApprovalService");

// 1. Extract uploaded images from HTML content for garbage collection tracking
const extractImagesFromHtml = (html) => {
  if (!html) return [];
  const images = [];
  const imgRegex = /src="[^"]*\/uploads\/([^"'\s>]+)"/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    images.push(match[1]);
  }
  return images;
};

// 2. Generate a unique, SEO-friendly URL slug with collision prevention against live DB and pending drafts
const generateUniqueSlug = async (Model, moduleName, title, id = null, slugField = "slug") => {
  let baseSlug = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  let finalSlug = baseSlug;
  let counter = 1;

  while (true) {
    // Check against live DB
    const whereClause = id
      ? { [slugField]: finalSlug, id: { [Op.ne]: id } }
      : { [slugField]: finalSlug };
    const existingLive = await Model.findOne({ where: whereClause });

    // Check against pending ERP drafts
    const existingDraft = await ApprovalDraft.findOne({
      where: {
        module_name: moduleName,
        status: "Pending",
        [Op.and]: sequelize.literal(
          `JSON_UNQUOTE(JSON_EXTRACT(payload, '$.${slugField}')) = '${finalSlug}'`,
        ),
      },
    });

    if (!existingLive && !existingDraft) break;

    finalSlug = `${baseSlug}-${counter}`;
    counter++;
  }
  return finalSlug;
};

// 3. Centralized Editor Staging Branch for Approval Draft creation and ERP submission
const handleEditorStaging = async ({
  req,
  res,
  t,
  moduleName,
  notransPrefix,
  action,
  targetId = null,
  payload = {},
  recordToLock = null,
  previousNotrans = null,
  successMessage = "Revisi diajukan. Data asli dikunci.",
  onSuccessCallback = null,
}) => {
  const actorId = String(req.owl_username || req.karyawanId || "System Admin");
  const notrans = await generateNotrans(notransPrefix);

  if (previousNotrans) {
    await ApprovalDraft.update(
      { status: "Replaced" },
      { where: { notrans: previousNotrans }, transaction: t },
    );
  }

  await ApprovalDraft.create(
    {
      notrans,
      module_name: moduleName,
      action: action.toUpperCase(),
      target_id: targetId ? String(targetId) : null,
      payload,
      created_by: actorId,
      status: "Pending",
    },
    { transaction: t },
  );

  if (recordToLock) {
    await recordToLock.update(
      { is_locked: true, lock_ticket: notrans },
      { transaction: t },
    );
  }

  await t.commit();

  try {
    const erpResult = await ErpApprovalService.initiateApproval({
      notrans,
      karyawanId: req.karyawanId ? String(req.karyawanId) : actorId,
      token: req.owl_token,
    });

    if (erpResult && erpResult.roadmap) {
      await ApprovalDraft.update(
        { approver_roadmap: erpResult.roadmap },
        { where: { notrans: notrans } }
      );
    }
  } catch (owlError) {
    console.error("🚨 [ERP SYNC FAILED]:", owlError.message);
  }

  if (onSuccessCallback) {
    // Run asynchronously without blocking
    onSuccessCallback(targetId, payload).catch((err) =>
      console.error("🚨 Background task failed:", err)
    );
  }

  return res.status(202).json({
    message: successMessage,
    ticket: notrans,
  });
};

module.exports = {
  extractImagesFromHtml,
  generateUniqueSlug,
  handleEditorStaging,
};
