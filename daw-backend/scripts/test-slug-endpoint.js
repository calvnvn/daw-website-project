const sequelize = require("../config/database");
const NewsCategory = require("../models/NewsCategory");
const NewsArticle = require("../models/NewsArticle");

// Daftarkan relasi persis seperti di server.js
NewsCategory.hasMany(NewsArticle, {
  foreignKey: "category_id",
  sourceKey: "id",
  as: "articles",
});

NewsArticle.belongsTo(NewsCategory, {
  foreignKey: "category_id",
  targetKey: "id",
  as: "categoryData",
});

const newsController = require("../controllers/newsController");

// Mocking Response Express untuk menangkap error
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    console.log(`\n🔴 API Mengembalikan HTTP ${res.statusCode}:`, JSON.stringify(data, null, 2));
    return res;
  };
  return res;
};

async function testEndpoint() {
  console.log("=== PENGUJIAN ENDPOINT GET PUBLIC NEWS BY SLUG ===");
  try {
    await sequelize.authenticate();
    console.log("✔ Database berhasil tersambung.");

    // Gunakan slug artikel yang sudah pasti ada di database Anda
    const targetSlug = "dream-2026-championing-consistent-innovation-for-sustainable-corporate-growth";
    
    const req = {
      params: { slug: targetSlug },
      query: { lang: "id" } // Kita uji terjemahan bahasa Indonesianya
    };
    
    const res = mockResponse();

    console.log(`\n-> Memanggil getPublicNewsBySlug dengan slug: "${targetSlug}" dan lang: "id"...`);
    
    // Panggil controller langsung
    await newsController.getPublicNewsBySlug(req, res);

  } catch (error) {
    console.error("❌ ERROR DI SCRIPT PENGETESAN:", error);
  } finally {
    process.exit(0);
  }
}

testEndpoint();
