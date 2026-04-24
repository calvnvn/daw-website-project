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
// 1. Global Security & Body Parser Middleware
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

// 3. Custom Interceptor Middleware (HARUS di atas express.static)
// Mengatasi masalah file .jpeg yang tersimpan sebagai .jpg atau sebaliknya
app.use("/uploads", (req, res, next) => {
  if (req.url.toLocaleLowerCase().endsWith(".jpeg")) {
    const altPath = req.url.replace(/\.jpeg$/i, ".jpg");
    if (fs.existsSync(path.join(uploadPath, altPath))) {
      return res.redirect(3.01, `/uploads${altPath}`);
    }
  }
  next();
});

// 4. Static File Server (Hanya melayani file jika file-nya ada)
app.use(
  "/uploads",
  express.static(uploadPath, {
    maxAge: "30d", // Menyuruh browser menyimpan cache selama 30 hari
    immutable: true, // Memberitahu browser bahwa file ini tidak akan berubah
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
    },
  }),
);

// ROUTER REGISTRATION
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/about", aboutRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/management", managementRoutes);
app.use("/api/investment", investmentRoutes);
app.use("/api/homepage", homeRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api/map-categories", mapCategoryRoutes);
app.use("/api/pages", pageRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/approval", approvalRoutes);
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

// // 2. Role & Permission Relations (Many-to-Many)
// Role.belongsToMany(Permission, {
//   through: RolePermission,
//   foreignKey: "roleId",
//   as: "permissions",
// });
// Permission.belongsToMany(Role, {
//   through: RolePermission,
//   foreignKey: "permissionId",
//   as: "roles",
// });

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

    // // // AUTO-SEED INQUIRY SUBJECTS
    // // const InquirySubject = require("./models/InquirySubject");
    // // try {
    // //   const count = await InquirySubject.count();
    // //   if (count === 0) {
    // //     await InquirySubject.bulkCreate([
    // //       { name: "General Inquiry", isActive: true },
    // //       { name: "Business Partnership", isActive: true },
    // //       { name: "Investment & ESG", isActive: true },
    // //       { name: "Careers & Internships", isActive: true },
    // //       { name: "Media & PR", isActive: true },
    // //     ]);
    // //     console.log("🌱 [SEED] Inquiry Subjects auto-seeded successfully!");
    // //   }
    // // } catch (err) {
    // //   console.error("❌ Gagal auto-seed subjects:", err.message);
    // // }

    // // AUTO-SEED ROLES & PERMISSIONS
    // try {
    //   // 1. SEED PERMISSIONS
    //   const permissionCount = await Permission.count();
    //   let allPermissions = [];
    //   if (permissionCount === 0) {
    //     console.log("🌱 [SEED] Initializing Permissions...");
    //     allPermissions = await Permission.bulkCreate([
    //       { name: "manage_homepage", description: "Access to Homepage" },
    //       { name: "manage_projects", description: "Access to Projects" },
    //       { name: "manage_businesses", description: "Access to Businesses" },
    //       { name: "manage_investments", description: "Access to Investments" },
    //       { name: "manage_about", description: "Access to About Us" },
    //       { name: "manage_inbox", description: "Access to Inbox" },
    //       { name: "manage_content", description: "Access to Content Manager" },
    //       { name: "manage_users", description: "Access to User Access" },
    //       { name: "manage_settings", description: "Access to Settings" },
    //     ]);
    //   } else {
    //     allPermissions = await Permission.findAll();
    //   }

    //   // 2. SEED ROLES
    //   const [superAdminRole] = await Role.findOrCreate({
    //     where: { name: "superadmin" },
    //     defaults: { description: "Ultimate Access (Bypass System)" },
    //   });

    //   const [editorRole] = await Role.findOrCreate({
    //     where: { name: "Editor" },
    //     defaults: { description: "Standard Editor Access" },
    //   });

    //   // 3. AUTO-MIGRATION LOGIC (Pindah data dari 'role' ke 'roleId')
    //   const usersToMigrate = await User.findAll({
    //     where: { roleId: null }, // Cari user yang belum punya roleId baru
    //   });

    //   if (usersToMigrate.length > 0) {
    //     console.log(
    //       `intl [MIGRATION] Found ${usersToMigrate.length} users to migrate to RBAC...`,
    //     );
    //     for (const user of usersToMigrate) {
    //       // Jika role lamanya superadmin, arahkan ke UUID superadmin yang baru
    //       if (user.role === "superadmin") {
    //         await user.update({ roleId: superAdminRole.id });
    //       } else {
    //         // Default ke Editor
    //         await user.update({ roleId: editorRole.id });
    //       }
    //     }
    //     console.log(
    //       "✅ [MIGRATION] User roles successfully migrated to UUID system!",
    //     );
    //   }

    //   // 4. SYNC PERMISSIONS FOR EDITOR (Contoh default akses Editor)
    //   const editorPermissions = await editorRole.getPermissions();
    //   if (editorPermissions.length === 0) {
    //     // Berikan akses default ke Editor (misal: Projects & Inbox)
    //     const defaultAkses = allPermissions.filter((p) =>
    //       ["manage_projects", "manage_inbox"].includes(p.name),
    //     );
    //     await editorRole.setPermissions(defaultAkses);
    //   }
    // } catch (err) {
    //   console.error("❌ RBAC Error:", err.message);
    // }
    // // =====================================

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
