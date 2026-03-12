const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const swaggerUi = require("swagger-ui-express");
const swaggerJsDoc = require("swagger-jsdoc");
const sequelize = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const projectRoutes = require("./routes/projectRoutes");
const historyRoutes = require("./routes/historyRoutes");
const aboutRoutes = require("./routes/aboutRoutes");
const managementRoutes = require("./routes/managementRoutes");
const investmentRoutes = require("./routes/investmentRoutes");
const homeRoutes = require("./routes/homeRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");

const HeroSlide = require("./models/HeroSlide");
const HomeSetting = require("./models/HomeSetting");
const ImpactStat = require("./models/ImpactStat");
const path = require("path");

dotenv.config();
const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/about", aboutRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/management", managementRoutes);
app.use("/api/investment", investmentRoutes);
app.use("/api/homepage", homeRoutes);
app.use("/api/inquiries", inquiryRoutes);

// --- SWAGGER API DOCS SETUP ---
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
        url: `http://localhost:${process.env.PORT || 5000}`,
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// --- BASIC ROUTE ---
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to DAW Group API",
    status: "Running",
    docs: "/api-docs",
  });
});

// --- START SERVER & DATABASE CONNECTION ---
const PORT = process.env.PORT || 5000;
require("./models/User");
require("./models/Project");
require("./models/Management");

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("[DATABASE] MySQL/MariaDB Connected & Tables Synced.");
    app.listen(PORT, () => {
      console.log(`[SERVER] Running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[DATABASE] Connection failed:", err.message);
    console.error(err);
  });
