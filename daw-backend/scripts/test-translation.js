const NewsArticle = require("../models/NewsArticle");
const Translation = require("../models/Translation");
const { autoTranslate } = require("../services/openaiService");
const sequelize = require("../config/database");

async function runTest() {
  console.log("=== MEMULAI PENGUJIAN SISTEM TERJEMAHAN ===");

  try {
    // 1. Uji konektivitas Database
    await sequelize.authenticate();
    console.log("✔ Database berhasil tersambung.");

    // 2. Cek apakah ada data di tabel NewsArticles
    const sampleArticle = await NewsArticle.findOne({
      where: { status: "Published" },
    });

    if (!sampleArticle) {
      console.log(
        "❌ Tidak ditemukan artikel dengan status 'Published' di database.",
      );
      console.log(
        "Silakan buat artikel draf/publikasi terlebih dahulu lewat CMS Admin.",
      );
      process.exit(1);
    }

    console.log(
      `✔ Menemukan Artikel Target: "${sampleArticle.title}" (ID: ${sampleArticle.id})`,
    );
    console.log("   Teks Asli Inggris: ", sampleArticle.title);

    // 3. Cek apakah kunci API OpenAI sudah dipasang
    if (!process.env.OPENAI_API_KEY) {
      console.warn(
        "⚠️ PERINGATAN: OPENAI_API_KEY tidak terdeteksi di file .env Anda.",
      );
      console.warn(
        "   Pengujian terjemahan akan gagal secara halus sesuai rancangan error-handling.",
      );
    }

    console.log(
      "\n-> Mencoba menerjemahkan judul artikel menggunakan ChatGPT API...",
    );
    const translatedTitle = await autoTranslate(
      sampleArticle.title,
      "Indonesian",
    );

    if (translatedTitle) {
      console.log("✔ SUKSES! Teks Terjemahan Indonesia: ", translatedTitle);

      // 4. Uji simpan ke Database Translations
      console.log("\n-> Menyimpan hasil uji terjemahan ke database...");

      const [translationRecord, created] = await Translation.findOrCreate({
        where: {
          modelName: "NewsArticle",
          recordId: sampleArticle.id,
          field: "title",
          locale: "id",
        },
        defaults: {
          translatedText: translatedTitle,
        },
      });

      if (!created) {
        // Jika sudah ada sebelumnya, kita timpa nilainya
        await translationRecord.update({ translatedText: translatedTitle });
        console.log("✔ Record terjemahan lama di database BERHASIL DI-UPDATE.");
      } else {
        console.log("✔ Record terjemahan baru di database BERHASIL DIBUAT.");
      }

      // 5. Uji baca balik data dari database
      const verifyDb = await Translation.findOne({
        where: {
          modelName: "NewsArticle",
          recordId: sampleArticle.id,
          locale: "id",
        },
      });
      console.log(
        "✔ Verifikasi Pembacaan DB: Teks di DB adalah =>",
        verifyDb.translatedText,
      );
      console.log("\n🎉 SELURUH SISTEM BEKERJA DENGAN SEMPURNA! 🎉");
    } else {
      console.log("❌ Gagal mendapatkan terjemahan.");
      console.log(
        "Kemungkinan penyebab: Kunci OpenAI di .env tidak valid atau limit API tercapai.",
      );
    }
  } catch (error) {
    console.error("❌ PENGUJIAN ERROR:", error.message);
  } finally {
    process.exit(0);
  }
}

runTest();
