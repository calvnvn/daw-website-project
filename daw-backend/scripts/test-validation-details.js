const sequelize = require("../config/database");
const NewsCategory = require("../models/NewsCategory");
const NewsArticle = require("../models/NewsArticle");
const newsController = require("../controllers/newsController");

NewsCategory.hasMany(NewsArticle, { foreignKey: "category_id", sourceKey: "id", as: "articles" });
NewsArticle.belongsTo(NewsCategory, { foreignKey: "category_id", targetKey: "id", as: "categoryData" });

// Mock Response untuk menangkap error mentah-mentah
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

async function diagnose() {
  console.log("=== DIAGNOSIS VALIDATION ERROR ===");
  try {
    await sequelize.authenticate();
    
    const req = {
      params: { slug: "dream-2026-championing-consistent-innovation-for-sustainable-corporate-growth" },
      query: { lang: "id" }
    };
    
    // Tangkap error secara manual dengan membungkus eksekusi controller
    try {
      await newsController.getPublicNewsBySlug(req, mockResponse());
    } catch (controllerErr) {
      console.log("\n❌ Berhasil menangkap error di pengetesan:");
      console.error(controllerErr);
      if (controllerErr.errors) {
        console.log("\n🔍 RINCIAN VALIDASI SEQUELIZE:");
        controllerErr.errors.forEach(err => {
          console.log(`- Path: ${err.path}`);
          console.log(`- Message: ${err.message}`);
          console.log(`- Value: ${err.value}`);
          console.log(`- Type: ${err.type}\n`);
        });
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}

diagnose();
