/**
 * MASTER DATABASE SEEDER SCRIPT
 * Lokasi: daw-backend/scripts/seed.js
 * * Deskripsi:
 * Menggunakan standar ORM Sequelize (bukan Raw SQL) untuk memastikan
 * tabel dibuat sesuai dengan definisi Model yang benar, dan menghindari
 * duplikasi data saat script dijalankan berulang kali.
 */

const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");

// Import SEMUA Model yang mau di-seed
const User = require("../models/User");
const Settings = require("../models/Settings");
const AboutInfo = require("../models/AboutInfo");
const History = require("../models/History");
const BusinessSection = require("../models/BusinessSection");

const DEFAULT_SETTINGS = {
  companyName: "PT Dharma Agung Wijaya",
  address:
    "Alamanda Tower, 22nd Floor\nJl. TB Simatupang Kav 23-24 Cilandak Barat, Jakarta Selatan",
  phone: "+62 21 2966 1956",
  email: "info@daw.co.id",
  website: "www.daw.co.id",
  googleMapsUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.993077647209!2d106.7997972153702!3d-6.290886195446487!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f1fb25b84539%3A0xc6226d9c612f0b78!2sAlamanda%20Tower!5e0!3m2!1sen!2sid!4v1680000000000!5m2!1sen!2sid",
  linkedinUrl: "https://www.linkedin.com/company/dharma-agung-wijaya",
};

const DEFAULT_PILLARS = [
  {
    id: "human",
    title: "Human Values",
    text: "To understand and apply humanitarian values...",
  },
  {
    id: "ethics",
    title: "Business Ethics",
    text: "Using the ethical norms prevailing...",
  },
  {
    id: "unity",
    title: "Unity Through Harmony",
    text: "To maintain harmony and unity...",
  },
  {
    id: "speed",
    title: "Speed and Leading Change",
    text: "To maintain and raise the speed...",
  },
  {
    id: "smart",
    title: "Working Smart in Learning Culture",
    text: "Diligent, persevering, serious...",
  },
];

const DEFAULT_HISTORIES = [
  {
    year: "2005",
    description:
      "DAW Group was founded in 2005 as an investment holding company in a food and beverage industry.",
  },
  {
    year: "2009",
    description:
      "In 2009, DAW Group was transformed as an operating holding company that focuses in resources and energy industry.",
  },
];

const DEFAULT_BUSINESSES = [
  {
    id: "resources",
    category: "Resources",
    title: "Resources Focus",
    htmlContent:
      "<h2>Initial Resources Content</h2><p>Please edit this in Admin Panel.</p>",
    hasMap: true,
  },
  {
    id: "energy",
    category: "Energy",
    title: "Energy Focus",
    htmlContent:
      "<h2>Initial Energy Content</h2><p>Please edit this in Admin Panel.</p>",
    hasMap: true,
  },
];

async function runMasterSeeder() {
  try {
    console.log("🚀 Memulai Master Seeder DAW Group...");

    // 1. SINKRONISASI MODEL (Aman, tidak akan drop tabel yang ada)
    await sequelize.sync();
    console.log("✅ Struktur tabel terverifikasi oleh Sequelize.");

    // 2. SEED SUPERADMIN
    const adminEmail = "jf.calvin20@gmail.com";
    const [admin, adminCreated] = await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        name: "Jap Calvin",
        password: await bcrypt.hash("AdminDaw123!", 10),
        role: "Superadmin",
        status: "Active",
      },
    });
    if (adminCreated) {
      console.log("✅ Akun Superadmin 'Jap Calvin' berhasil dibuat!");
    } else {
      console.log("ℹ️ Akun Superadmin sudah ada di database. Melewati...");
    }

    // 3. SEED SETTINGS
    const [settings, settingsCreated] = await Settings.findOrCreate({
      where: { id: 1 },
      defaults: DEFAULT_SETTINGS,
    });
    console.log(
      settingsCreated
        ? "✅ Default Settings ditambahkan."
        : "ℹ️ Settings sudah ada.",
    );

    // 4. SEED ABOUT INFO
    const [about, aboutCreated] = await AboutInfo.findOrCreate({
      where: { id: 1 },
      defaults: {
        spiritText:
          "Success is born through honesty, persistence, and commitment in the light of constant prayer.",
        missionText:
          "We are a transformation-making company that creates value to society based on interdependence co-arising.",
        visionText:
          "To become one of the most respected palm oil and renewable energy companies, in terms of operational excellence and commitment to live in harmony with mother nature.",
        philosophyTitle: "Our Philosophy",
        philosophyPillars: DEFAULT_PILLARS,
      },
    });
    console.log(
      aboutCreated
        ? "✅ Default About Info & Philosophy ditambahkan."
        : "ℹ️ About Info sudah ada.",
    );

    // 5. SEED HISTORIES
    const historyCount = await History.count();
    if (historyCount === 0) {
      await History.bulkCreate(DEFAULT_HISTORIES);
      console.log("✅ Default Histories (Timeline) ditambahkan.");
    } else {
      console.log("ℹ️ Histories sudah terisi. Melewati...");
    }

    // 6. SEED BUSINESS SECTIONS
    for (const item of DEFAULT_BUSINESSES) {
      const [biz, bizCreated] = await BusinessSection.findOrCreate({
        where: { id: item.id },
        defaults: item,
      });
      if (bizCreated)
        console.log(`✅ Business Section '${item.category}' ditambahkan.`);
    }

    console.log("\n🎉 BOOM! Master Seeding Selesai dengan Sempurna!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Gagal melakukan seeding:", error);
    process.exit(1);
  }
}

// Jalankan Seeder
runMasterSeeder();
