const ApprovalDraft = require("../models/ApprovalDraft");

const invalidateOldDrafts = async (
  moduleName,
  targetId,
  transaction = null,
) => {
  return await ApprovalDraft.update(
    {
      status: "Replaced",
      rejection_reason:
        "Otomatis dibatalkan: superadmin melakukan perubahan langsung pada data asli (Override).",
    },
    {
      where: {
        module_name: moduleName,
        target_id: String(targetId),
        status: "Pending",
      },
      transaction,
    },
  );
};

module.exports = { invalidateOldDrafts };
