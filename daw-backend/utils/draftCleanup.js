const ApprovalDraft = require("../models/ApprovalDraft");

/**
 * Membatalkan draf pending yang ada jika Superadmin melakukan bypass/update langsung.
 * @param {string} moduleName - Nama model (Project, Management, dll)
 * @param {string|number} targetId - ID baris data yang sedang di-lock
 * @param {object} transaction - Objek transaksi Sequelize (opsional)
 */
const invalidateOldDrafts = async (
  moduleName,
  targetId,
  transaction = null,
) => {
  return await ApprovalDraft.update(
    {
      status: "Replaced",
      rejection_reason:
        "Otomatis dibatalkan: Superadmin melakukan perubahan langsung pada data asli (Override).",
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
