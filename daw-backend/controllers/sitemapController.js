const fs = require("fs");
const path = require("path");
const Page = require("../models/Page");
const Project = require("../models/Project");
const NewsArticle = require("../models/NewsArticle");

// Dynamic sitemap generator including pages, projects, and news articles
exports.generateSitemap = async (req, res) => {
  try {
    const rawBaseUrl = process.env.FRONTEND_URL || "https://daw.co.id";
    const baseUrl = rawBaseUrl.replace(/\/$/, "");

    const pages = await Page.findAll({
      attributes: ["slug", "updatedAt"],
    });

    const projects = await Project.findAll({
      where: { status: "Published" },
      attributes: ["slug", "updatedAt"],
    });

    const newsArticles = await NewsArticle.findAll({
      where: { status: "Published" },
      attributes: ["slug", "updatedAt"],
    });

    const staticRoutes = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/businesses", priority: "0.9", changefreq: "weekly" },
      { url: "/about", priority: "0.8", changefreq: "weekly" },
      { url: "/contact-us", priority: "0.7", changefreq: "monthly" },
      { url: "/news", priority: "0.8", changefreq: "daily" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const today = new Date().toISOString().split("T")[0];

    // 1. Static Routes
    staticRoutes.forEach((route) => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${route.url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // 2. Dynamic Pages
    pages.forEach((page) => {
      const lastModDate = page.updatedAt
        ? page.updatedAt.toISOString().split("T")[0]
        : today;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/page/${page.slug}</loc>\n`;
      xml += `    <lastmod>${lastModDate}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    });

    // 3. Projects
    projects.forEach((project) => {
      const lastModDate = project.updatedAt
        ? project.updatedAt.toISOString().split("T")[0]
        : today;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/projects/${project.slug}</loc>\n`;
      xml += `    <lastmod>${lastModDate}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    // 4. News & Events Articles
    newsArticles.forEach((article) => {
      const lastModDate = article.updatedAt
        ? article.updatedAt.toISOString().split("T")[0]
        : today;
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/news/${article.slug}</loc>\n`;
      xml += `    <lastmod>${lastModDate}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (error) {
    console.error("🚨 SITEMAP ERROR:", error);
    res.status(500).send("Error generating sitemap");
  }
};

// Dynamic robots.txt generator pointing to our actual frontend & sitemap url
exports.generateRobotsTxt = async (req, res) => {
  try {
    const robotsPath = path.join(process.cwd(), "public", "robots.txt");
    if (fs.existsSync(robotsPath)) {
      const content = fs.readFileSync(robotsPath, "utf8");
      res.type("text/plain");
      return res.status(200).send(content);
    }
    
    // Optimized default if robots.txt file is missing
    const rawBaseUrl = process.env.FRONTEND_URL || "https://daw.co.id";
    const baseUrl = rawBaseUrl.replace(/\/$/, "");
    const defaultRobots = 
`# Dynamic robots.txt default
User-agent: *
Disallow: /api/
Disallow: /uploads/
Allow: /robots.txt
Allow: /sitemap.xml

Sitemap: ${baseUrl}/sitemap.xml`;

    res.type("text/plain");
    res.status(200).send(defaultRobots);
  } catch (error) {
    console.error("🚨 ROBOTS.TXT GENERATION ERROR:", error);
    res.status(500).send("Error serving robots.txt");
  }
};

// Get raw robots.txt content for CMS edit panel
exports.getRobotsContent = async (req, res) => {
  try {
    const robotsPath = path.join(process.cwd(), "public", "robots.txt");
    let content = "";
    if (fs.existsSync(robotsPath)) {
      content = fs.readFileSync(robotsPath, "utf8");
    } else {
      const rawBaseUrl = process.env.FRONTEND_URL || "https://daw.co.id";
      const baseUrl = rawBaseUrl.replace(/\/$/, "");
      content = 
`# Dynamic robots.txt
User-agent: *
Disallow: /api/
Disallow: /uploads/
Allow: /robots.txt
Allow: /sitemap.xml

Sitemap: ${baseUrl}/sitemap.xml`;
    }
    res.status(200).json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Save edited robots.txt content from CMS settings
exports.updateRobotsContent = async (req, res) => {
  try {
    const { content } = req.body;
    if (content === undefined) {
      return res.status(400).json({ success: false, message: "Content cannot be empty" });
    }
    
    const robotsPath = path.join(process.cwd(), "public", "robots.txt");
    const publicDir = path.join(process.cwd(), "public");
    
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    fs.writeFileSync(robotsPath, content, "utf8");
    res.status(200).json({ success: true, message: "robots.txt successfully updated!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
