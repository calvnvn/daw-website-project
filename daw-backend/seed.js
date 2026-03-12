/**
 * DATABASE SEEDER SCRIPT
 * * Deskripsi:
 * Script ini berfungsi untuk menginisialisasi database, membuat tabel-tabel utama
 * (Users, Projects, Settings, AboutInfo), dan mengisi data awal (seeding).
 * * Penggunaan: node seed.js
 */

const sequelize = require("./config/database");
const bcrypt = require("bcryptjs");

const DEFAULT_SETTINGS = {
  name: "PT Dharma Agung Wijaya",
  addr: "Alamanda Tower, 22nd Floor\nJl. TB Simatupang Kav 23-24 Cilandak Barat, Jakarta Selatan",
  phone: "+62 21 2966 1956",
  mail: "info@daw.co.id",
  web: "www.daw.co.id",
  maps: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3965.993077647209!2d106.7997972153702!3d-6.290886195446487!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f1fb25b84539%3A0xc6226d9c612f0b78!2sAlamanda%20Tower!5e0!3m2!1sen!2sid!4v1680000000000!5m2!1sen!2sid",
  li: "https://www.linkedin.com/company/dharma-agung-wijaya",
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

async function seedDatabase() {
  try {
    console.log("--- Memulai Sinkronisasi Database ---");

    // ---------------------------------------------------------
    // 0. RESET TABEL (Opsional)
    // ---------------------------------------------------------
    /* console.log("Menghapus tabel lama...");
    await sequelize.query("DROP TABLE IF EXISTS Projects;");
    await sequelize.query("DROP TABLE IF EXISTS Users;");
    await sequelize.query("DROP TABLE IF EXISTS Settings;");
    await sequelize.query("DROP TABLE IF EXISTS AboutInfo;");
    */

    // ---------------------------------------------------------
    // 1. SKEMA TABEL: USERS
    // ---------------------------------------------------------
    console.log("[1/4] Membuat tabel Users...");
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS Users (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ---------------------------------------------------------
    // 2. SKEMA TABEL: PROJECTS
    // ---------------------------------------------------------
    console.log("[2/4] Membuat tabel Projects...");
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS Projects (
        id CHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        excerpt VARCHAR(500), 
        content TEXT,
        category VARCHAR(100),
        status VARCHAR(50),
        author VARCHAR(100),
        cover_image VARCHAR(255),
        gallery JSON,
        views INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ---------------------------------------------------------
    // 3. SKEMA TABEL: SETTINGS
    // ---------------------------------------------------------
    console.log("[3/4] Membuat tabel Settings...");
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS Settings (
        id INT PRIMARY KEY DEFAULT 1,
        companyName VARCHAR(255),
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(100),
        website VARCHAR(100),
        googleMapsUrl TEXT,
        linkedinUrl VARCHAR(255),
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ---------------------------------------------------------
    // 4. SKEMA TABEL: ABOUT INFO & PHILOSOPHY
    // ---------------------------------------------------------
    console.log("[4/4] Membuat tabel AboutInfo...");
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS AboutInfo (
        id INT PRIMARY KEY DEFAULT 1,
        spiritText TEXT,
        missionText TEXT,
        visionText TEXT,
        philosophyTitle VARCHAR(255),
        philosophyPillars JSON,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ---------------------------------------------------------
    // 5. SKEMA TABEL: HISTORIES (TIMELINE)
    // ---------------------------------------------------------
    console.log("Membuat tabel Histories...");
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS Histories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        year VARCHAR(10) NOT NULL,
        description TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ---------------------------------------------------------
    // 5. INJEKSI DATA: ADMIN USER
    // ---------------------------------------------------------
    console.log(">> Menyuntikkan data Admin...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    await sequelize.query(
      `INSERT IGNORE INTO Users (id, name, email, password) 
       VALUES (UUID(), 'Calvin', 'jf.calvin20@gmail.com', :password)`,
      { replacements: { password: hashedPassword } },
    );

    // ---------------------------------------------------------
    // 6. INJEKSI DATA: SETTINGS
    // ---------------------------------------------------------
    console.log(">> Menyuntikkan data Settings...");
    await sequelize.query(
      `INSERT IGNORE INTO Settings (id, companyName, address, phone, email, website, googleMapsUrl, linkedinUrl)
       VALUES (1, :name, :addr, :phone, :mail, :web, :maps, :li)`,
      {
        replacements: DEFAULT_SETTINGS,
        type: sequelize.QueryTypes.INSERT,
      },
    );

    // ---------------------------------------------------------
    // 7. INJEKSI DATA: ABOUT INFO (Hanya jika kosong)
    // ---------------------------------------------------------
    const [aboutCount] = await sequelize.query(
      "SELECT COUNT(*) as total FROM AboutInfo",
    );

    if (aboutCount[0].total === 0) {
      console.log(">> Inject data default AboutInfo...");

      await sequelize.query(
        `INSERT INTO AboutInfo (id, spiritText, missionText, visionText, philosophyTitle, philosophyPillars)
         VALUES (
           1, 
           'Success is born through honesty, persistence, and commitment in the light of constant prayer.',
           'We are a transformation-making company that creates value to society based on interdependence co-arising.',
           'To become one of the most respected palm oil and renewable energy companies, in terms of operational excellence and commitment to live in harmony with mother nature.',
           'Our Philosophy',
           :pillars
         )`,
        {
          replacements: { pillars: JSON.stringify(DEFAULT_PILLARS) },
        },
      );
    }

    // ---------------------------------------------------------
    // 7. INJEKSI DATA: HISTORIES (Hanya jika kosong)
    // ---------------------------------------------------------
    const [historyCount] = await sequelize.query(
      "SELECT COUNT(*) as total FROM Histories",
    );
    if (historyCount[0].total === 0) {
      console.log("Menyuntikkan data default Histories...");
      await sequelize.query(`
        INSERT INTO Histories (year, description) VALUES 
        ('2005', 'DAW Group was founded in 2005 as an investment holding company in a food and beverage industry.'),
        ('2009', 'In 2009, DAW Group was transformed as an operating holding company that focuses in resources and energy industry.')
      `);
    }

    console.log("\n✅ Database berhasil di-sinkronisasi dan di-seed!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Gagal melakukan seeding:", error);
    process.exit(1);
  }
}

// Jalankan proses seeding
seedDatabase();
