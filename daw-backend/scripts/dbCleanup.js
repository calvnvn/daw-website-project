const sequelize = require("../config/database");
const { Op } = require("sequelize");

async function cleanup() {
  console.log("🚀 Starting Database Health Recovery...");

  try {
    // 1. Ambil semua draf yang statusnya bukan Pending
    // (Bisa lo modifikasi untuk hapus tiket tertentu)
    const result = await sequelize.query(`
      DELETE FROM ApprovalDrafts 
      WHERE status IN ('Rejected', 'Approved') 
      OR updatedAt < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    console.log("✅ Old/Completed drafts cleaned.");

    // 2. Loop semua tabel yang punya gembok dan reset jika tiketnya ga ada di draf
    const tables = [
      "Projects",
      "Affiliates",
      "Managements",
      "AboutInfo",
      "BusinessSections",
      "HeroSlides",
      "Histories",
      "ImpactStats",
      "InvestmentSettings",
      "Settings",
      "Pages",
      "Menus",
    ];

    for (const table of tables) {
      await sequelize.query(`
        UPDATE ${table} 
        SET is_locked = 0, lock_ticket = NULL 
        WHERE is_locked = 1 
        AND lock_ticket NOT IN (SELECT notrans FROM ApprovalDrafts WHERE status = 'Pending')
      `);
      console.log(`--- Table ${table} locks verified.`);
    }

    console.log("🏁 Cleanup Finished Successfully!");
  } catch (error) {
    console.error("🚨 Cleanup Failed:", error);
  } finally {
    process.exit();
  }
}

cleanup();
