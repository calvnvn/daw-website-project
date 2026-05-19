require("dotenv").config();
console.log("Cek Mode:", process.env.NODE_ENV);

const express = require("express");
const cors = require("cors");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

/**
 * Application Entry Point
 * Orchestrates the Express server lifecycle, middleware pipeline, database synchronization, and API routing.
 */

// INITIALIZATION: Database & Service Configurations
const sequelize = require("./config/database");
const { startCleanupTask } = require("./utils/cleanupWorker");

// INITIALIZATION: Route Modules
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

// INITIALIZATION: Model Registry
const User = require("./models/User");
const Role = require("./models/Role");
const Project = require("./models/Project");
const BusinessSection = require("./models/BusinessSection");
const MapCategory = require("./models/MapCategory");
const BusinessMapMarker = require("./models/BusinessMapMarker");

// Load supplementary models for schema synchronization
require("./models/Management");
require("./models/Settings");
require("./models/AboutInfo");
require("./models/History");
require("./models/HeroSlides");
require("./models/HomeSettings");
require("./models/ImpactStats");
require("./models/Page");
require("./models/Menu");
require("./models/Affiliate");
require("./models/Inquiry");
require("./models/InquirySubject");
require("./models/InvestmentSettings");
require("./models/ApprovalDraft");

const app = express();

// MIDDLEWARE: Security & Request Parsing
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// REFERENCE GATHERING: File System Setup
// Resolve absolute storage paths and ensure physical directory presence
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

// EXECUTION: Interceptor & Static Assets
// Enforce asset extension normalization for legacy compatibility
app.use("/uploads", (req, res, next) => {
  if (req.url.toLocaleLowerCase().endsWith(".jpeg")) {
    const altPath = req.url.replace(/\.jpeg$/i, ".jpg");
    if (fs.existsSync(path.join(uploadPath, altPath))) {
      return res.redirect(301, `/uploads${altPath}`);
    }
  }
  next();
});

// Serve optimized static assets with immutable cache headers
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

// Resolve and serve crawler instructions
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

// EXECUTION: API Router Registration
// Map logical resource domains to dedicated route handlers
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

// Mount core health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to DAW Group API",
    status: "Healthy",
    uptime: process.uptime(),
    docs: "/api-docs",
  });
});

// Initialize scheduled background maintenance tasks
startCleanupTask();
console.log("🚀 [SYSTEM] Weekly Cleanup Worker has been initialized.");

// EXECUTION: Documentation Engine
// Parse OpenApi specifications and mount interactive Swagger UI
try {
  const yamlPath = path.join(__dirname, "./docs/openapi.yaml");
  const swaggerDocument = yaml.load(fs.readFileSync(yamlPath, "utf8"));

  swaggerDocument.servers = [
    {
      url:
        process.env.BACKEND_URL ||
        `http://localhost:${process.env.PORT || 5550}`,
      description: "Current Environment",
    },
  ];

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      swaggerOptions: {
        persistAuthorization: true,
      },
      customSiteTitle: "DAW Group CMS API Documentation",
    }),
  );

  console.log("Swagger Docs loaded from openapi.yaml");
} catch (e) {
  console.error("Gagal memuat file Swagger YAML:", e.message);
}

// REFERENCE GATHERING: Relational Mapping
// Define entity associations and referential integrity constraints
Role.hasMany(User, { foreignKey: "roleId", as: "users" });
User.belongsTo(Role, { foreignKey: "roleId", as: "roleData" });

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
  foreignKey: "category",
  sourceKey: "id",
  as: "projects",
});

Project.belongsTo(BusinessSection, {
  foreignKey: "category",
  targetKey: "id",
  as: "sectorData",
});

// EXECUTION: Server Bootstrap
// Synchronize schema state and initialize listener on designated port
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
