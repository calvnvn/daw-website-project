const sequelize = require("../config/database");
const Translation = require("../models/Translation");

async function clearBadTranslation() {
  console.log("=== MEMBERSIHKAN DATA TERJEMAHAN KOTOR DI DATABASE ===");
  try {
    await sequelize.authenticate();
    
    // Hapus record terjemahan untuk artikel DREAM 2026 yang memiliki <h1>
    const affectedRows = await Translation.destroy({
      where: {
        modelName: "NewsArticle",
        recordId: "cea3a3b6-6552-4f3b-a13d-8707ae5848f6",
        locale: "id"
      }
    });

    console.log(`✔ Berhasil menghapus ${affectedRows} record terjemahan kotor.`);
    console.log("Database siap memicu auto-translate ulang yang bersih 100%!");
  } catch (error) {
    console.error("❌ Gagal membersihkan database:", error.message);
  } finally {
    process.exit(0);
  }
}

clearBadTranslation();
