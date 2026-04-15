/**
 * Utility untuk men-generate Nomor Transaksi (notrans).
 * Format: CMS/{MODUL}/{YYYYMMDD}/{RANDOM_5_CHAR}
 * Contoh: CMS/PROJ/20260415/K7X2P
 */

const generateNotrans = (moduleName) => {
  // Ambil 4 Huruf Pertama Modul & Jadikan Uppercase (Contoh: Project -> PROJ)
  const mod = moduleName.substring(0, 4).toUpperCase();

  // Format Tanggal YYYYMMDD (WIB/Local Time)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  // Generate 5 Karakter Random Alphanumeric
  // Menggunakan substring(2, 7) dari string base36 (0-9, a-z)
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();

  // 4. Gabungkan (Join)
  return `CMS/${mod}/${dateStr}/${randomStr}`;
};

module.exports = { generateNotrans };
