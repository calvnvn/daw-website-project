require("dotenv").config();
const express = require("express");
const cors = require("cors");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

// 1. CONFIG & DATABASE IMPORT
const sequelize = require("./config/database");

// 2. ROUTES IMPORT
const authRoutes = require("./routes/authRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const projectRoutes = require("./routes/projectRoutes");
const historyRoutes = require("./routes/historyRoutes");
const aboutRoutes = require("./routes/aboutRoutes");
const managementRoutes = require("./routes/managementRoutes");
const investmentRoutes = require("./routes/investmentRoutes");
const homeRoutes = require("./routes/homeRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const businessRoutes = require("./routes/businessRoutes");
const pageRoutes = require("./routes/pageRoutes");
const menuRoutes = require("./routes/menuRoutes");
const sitemapRoutes = require("./routes/sitemapRoutes");
const mapCategoryRoutes = require("./routes/mapCategoryRoutes");
const approvalRoutes = require("./routes/approvalRoutes");
const philosophyRoutes = require("./routes/philosophyRoutes");
const philosophyPillarRoutes = require("./routes/philosophyPillarRoutes");

// 3. MODELS IMPORT
const User = require("./models/User");
const Role = require("./models/Role");
// const Permission = require("./models/Permission");
// const RolePermission = require("./models/RolePermission");
const Project = require("./models/Project");
require("./models/Management");
require("./models/Settings");
require("./models/AboutInfo");
require("./models/History");
require("./models/HeroSlides");
require("./models/HomeSettings");
require("./models/ImpactStats");
const BusinessSection = require("./models/BusinessSection");
const MapCategory = require("./models/MapCategory");
const BusinessMapMarker = require("./models/BusinessMapMarker");
require("./models/Page");
require("./models/Menu");
require("./models/Affiliate");
require("./models/Inquiry");
require("./models/InquirySubject");
require("./models/InvestmentSettings");
require("./models/ApprovalDraft");
const { startCleanupTask } = require("./utils/cleanupWorker");

const app = express();

// MIDDLEWARE PIPELINE
// Global Security & Body Parser Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 2. File Uploads Directory Setup
// Menggunakan process.cwd() agar path selalu stabil tidak peduli dari mana script di-run
const uploadPath = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadPath)) {
  console.warn(
    "Folder uploads tidak ditemukan. Membuat folder baru di:",
    uploadPath,
  );
  fs.mkdirSync(uploadPath, { recursive: true });
} else {
  console.log("SUCCESS: Folder uploads terhubung di:", uploadPath);
}

// Custom Interceptor Middleware (
app.use("/uploads", (req, res, next) => {
  if (req.url.toLocaleLowerCase().endsWith(".jpeg")) {
    const altPath = req.url.replace(/\.jpeg$/i, ".jpg");
    if (fs.existsSync(path.join(uploadPath, altPath))) {
      return res.redirect(301, `/uploads${altPath}`);
    }
  }
  next();
});

// 4. Static File Server
app.use(
  "/uploads",
  express.static(uploadPath, {
    maxAge: "30d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  }),
);

app.get("/robots.txt", (req, res) => {
  const robotsPath = path.join(process.cwd(), "public", "robots.txt");
  if (fs.existsSync(robotsPath)) {
    res.type("text/plain");
    res.sendFile(robotsPath);
  } else {
    res.type("text/plain");
    res.send("User-agent: *\nDisallow: /");
  }
});

// ROUTER REGISTRATION
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/about", aboutRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/management", managementRoutes);
app.use("/api/investments", investmentRoutes);
app.use("/api/homepage", homeRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/map-categories", mapCategoryRoutes);
app.use("/api/pages", pageRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/approval", approvalRoutes);
app.use("/api/philosophy", philosophyRoutes);
app.use("/api/philosophy-pillars", philosophyPillarRoutes);

app.use("/", sitemapRoutes);

// Base Health Check Route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to DAW Group API",
    status: "Healthy",
    uptime: process.uptime(),
    docs: "/api-docs",
  });
});

// Cronjob
startCleanupTask();
console.log("🚀 [SYSTEM] Weekly Cleanup Worker has been initialized.");

// SWAGGER API DOCS SETUP
try {
  // 1. Tentukan path ke file openapi.yaml
  const yamlPath = path.join(__dirname, "./docs/openapi.yaml");

  // 2. Baca dan parsing file YAML
  const swaggerDocument = yaml.load(fs.readFileSync(yamlPath, "utf8"));

  // 3. Masukkan konfigurasi server dinamis (opsional, agar tetap fleksibel)
  swaggerDocument.servers = [
    {
      url:
        process.env.BACKEND_URL ||
        `http://localhost:${process.env.PORT || 5550}`,
      description: "Current Environment",
    },
  ];

  // 4. Jalankan Swagger UI
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true, // Biar token OWL gak hilang saat di-refresh
      },
      customSiteTitle: "DAW Group CMS API Documentation",
    }),
  );

  console.log("Swagger Docs loaded from openapi.yaml");
} catch (e) {
  console.error("Gagal memuat file Swagger YAML:", e.message);
}
// DATABASE ASSOCIATIONS (Relationships)

// // 1. User & Role Relations
Role.hasMany(User, { foreignKey: "roleId", as: "users" });
User.belongsTo(Role, { foreignKey: "roleId", as: "roleData" });

//3. Business Map Relations
BusinessSection.hasMany(BusinessMapMarker, {
  foreignKey: "sectionId",
  sourceKey: "id",
  as: "mapMarkers",
  onDelete: "CASCADE",
});

MapCategory.hasMany(BusinessMapMarker, {
  foreignKey: "categoryId",
  as: "markers",
});

BusinessMapMarker.belongsTo(BusinessSection, {
  foreignKey: "sectionId",
  targetKey: "id",
});

BusinessMapMarker.belongsTo(MapCategory, {
  foreignKey: "categoryId",
  as: "categoryData",
});

BusinessSection.hasMany(Project, {
  foreignKey: "category", // Kolom di tabel Project
  sourceKey: "id", // Kolom id (slug) di BusinessSection
  as: "projects",
});

// Satu Proyek merujuk ke satu Sektor
Project.belongsTo(BusinessSection, {
  foreignKey: "category",
  targetKey: "id",
  as: "sectorData", // Alias agar rapi saat dipanggil (e.g. project.sectorData.category)
});

// BOOTSTRAP SERVER & DATABASE
const PORT = process.env.PORT || 5000;

sequelize
  .sync({ alter: false })
  .then(async () => {
    console.log("[DATABASE] MySQL/MariaDB Connected & Tables Synced.");

    app.listen(PORT, () => {
      console.log(`[SERVER] Running cleanly on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(
      "[CRITICAL ERROR] Database connection failed. Shutting down.",
    );
    console.error(err.message);
    process.exit(1);
  });
