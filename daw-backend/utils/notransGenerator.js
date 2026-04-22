/**
 * Utility untuk men-generate Nomor Transaksi (notrans).
 * Format: CMS/{MODUL}/{YYYYMMDD}/{RANDOM_5_CHAR}
 * Version: 2.0 (Bulletproof Edition)
 */

const generateNotrans = (moduleName) => {
  let safeModuleName = moduleName;

  if (
    moduleName &&
    typeof moduleName === "string" &&
    moduleName.trim() !== ""
  ) {
    safeModuleName = moduleName.trim();
  }

  const mod = safeModuleName.substring(0, 4).toUpperCase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();

  const result = `CMS/${mod}/${dateStr}/${randomStr}`;

  console.log(`>>> [GENERATOR] Created Ticket: ${result}`);

  return result;
};

module.exports = { generateNotrans };
