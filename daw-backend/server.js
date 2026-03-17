require("dotenv").config(); // Load environment variables
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");

// --- 1. CONFIG & DATABASE IMPORT ---
const sequelize = require("./config/database");

// --- 2. ROUTES IMPORT ---
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
const dashboardRoutes = require("./routes/dashboardRoutes");
const businessRoutes = require("./routes/businessRoutes");
const pageRoutes = require("./routes/pageRoutes");
const menuRoutes = require("./routes/menuRoutes");

// --- 3. MODELS IMPORT ---
require("./models/User");
require("./models/Project");
require("./models/Management");
const HeroSlide = require("./models/HeroSlide");
const HomeSetting = require("./models/HomeSetting");
const ImpactStat = require("./models/ImpactStat");
const BusinessSection = require("./models/BusinessSection");
const BusinessMapMarker = require("./models/BusinessMapMarker");
const Page = require("./models/Page");
const Menu = require("./models/Menu");

const app = express();

// MIDDLEWARE PIPELINE
// 1. Global Security & Body Parser Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 2. File Uploads Directory Setup
// Menggunakan process.cwd() agar path selalu stabil tidak peduli dari mana script di-run
const uploadPath = path.join(process.cwd(), "public", "uploads");

// Auto-create folder uploads jika belum ada (Best practice untuk deployment baru)
if (!fs.existsSync(uploadPath)) {
  console.warn(
    "⚠️ Folder uploads tidak ditemukan. Membuat folder baru di:",
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
    // Cek apakah file .jpg nya ada
    if (fs.existsSync(path.join(uploadPath, altPath))) {
      return res.redirect(3.01, `/uploads${altPath}`); // 301 Permanent Redirect
    }
  }
  next(); // Lanjut ke middleware berikutnya jika bukan .jpeg
});

// 4. Static File Server (Hanya melayani file jika file-nya ada)
app.use("/uploads", express.static(uploadPath));

// ROUTER REGISTRATION

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
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
app.use("/api/pages", pageRoutes);
app.use("/api/menus", menuRoutes);

// Base Health Check Route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to DAW Group API",
    status: "Healthy",
    uptime: process.uptime(),
    docs: "/api-docs",
  });
});

// SWAGGER API DOCS SETUP
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "DAW Group CMS API",
      version: "1.0.0",
      description: "REST API Documentation for PT Dharma Agung Wijaya CMS",
    },
    servers: [
      {
        url:
          process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`,
        description: "Current Environment",
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// DATABASE ASSOCIATIONS (Relationships)
BusinessSection.hasMany(BusinessMapMarker, {
  foreignKey: "sectionId",
  sourceKey: "id",
  as: "mapMarkers",
  onDelete: "CASCADE",
});

BusinessMapMarker.belongsTo(BusinessSection, {
  foreignKey: "sectionId",
  targetKey: "id",
});

// BOOTSTRAP SERVER & DATABASE
const PORT = process.env.PORT || 5000;

sequelize
  .sync({ alter: false }) // Hindari alter: true di production karena bisa mengunci/drop tabel
  .then(() => {
    console.log("[DATABASE] MySQL/MariaDB Connected & Tables Synced.");
    // Server baru menyala SETELAH database dipastikan aman
    app.listen(PORT, () => {
      console.log(`[SERVER] Running cleanly on port ${PORT}`);
      console.log(
        `[DOCS] Swagger available at http://localhost:${PORT}/api-docs`,
      );
    });
  })
  .catch((err) => {
    // FIXED: Jangan nyalakan server jika database mati.
    // Biarkan process exit agar PM2 / Docker merestart container secara otomatis.
    console.error(
      "[CRITICAL ERROR] Database connection failed. Shutting down.",
    );
    console.error(err.message);
    process.exit(1);
  });
