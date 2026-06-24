const fs = require("fs");
const path = require("path");
const Page = require("../models/Page");
const Project = require("../models/Project");
const NewsArticle = require("../models/NewsArticle");

class SitemapService {
  async generateSitemap() {
    const rawBaseUrl = process.env.FRONTEND_URL || "https://daw.co.id";
    const baseUrl = rawBaseUrl.replace(/\/$/, "");

    const pages = await Page.findAll({ attributes: ["slug", "updatedAt"] });
    const projects = await Project.findAll({ where: { status: "Published" }, attributes: ["slug", "updatedAt"] });
    const newsArticles = await NewsArticle.findAll({ where: { status: "Published" }, attributes: ["slug", "updatedAt"] });

    const staticRoutes = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/businesses", priority: "0.9", changefreq: "weekly" },
      { url: "/about", priority: "0.8", changefreq: "weekly" },
      { url: "/contact-us", priority: "0.7", changefreq: "monthly" },
      { url: "/news", priority: "0.8", changefreq: "daily" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    const today = new Date().toISOString().split("T")[0];

    staticRoutes.forEach((route) => {
      xml += `  <url>\n    <loc>${baseUrl}${route.url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n  </url>\n`;
    });

    pages.forEach((page) => {
      const lastModDate = page.updatedAt ? page.updatedAt.toISOString().split("T")[0] : today;
      xml += `  <url>\n    <loc>${baseUrl}/page/${page.slug}</loc>\n    <lastmod>${lastModDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    });

    projects.forEach((project) => {
      const lastModDate = project.updatedAt ? project.updatedAt.toISOString().split("T")[0] : today;
      xml += `  <url>\n    <loc>${baseUrl}/projects/${project.slug}</loc>\n    <lastmod>${lastModDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    newsArticles.forEach((article) => {
      const lastModDate = article.updatedAt ? article.updatedAt.toISOString().split("T")[0] : today;
      xml += `  <url>\n    <loc>${baseUrl}/news/${article.slug}</loc>\n    <lastmod>${lastModDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    xml += `</urlset>`;
    return xml;
  }

/*
  async generateRobotsTxt() {
    const robotsPath = path.join(process.cwd(), "public", "robots.txt");
    if (fs.existsSync(robotsPath)) {
      return fs.readFileSync(robotsPath, "utf8");
    }
    
    const rawBaseUrl = process.env.FRONTEND_URL || "https://daw.co.id";
    const baseUrl = rawBaseUrl.replace(/\/$/, "");
    return `# Dynamic robots.txt default
User-agent: *
Disallow: /api/
Disallow: /uploads/
Allow: /robots.txt
Allow: /sitemap.xml

Sitemap: ${baseUrl}/sitemap.xml`;
  }

  async getRobotsContent() {
    const robotsPath = path.join(process.cwd(), "public", "robots.txt");
    if (fs.existsSync(robotsPath)) {
      return fs.readFileSync(robotsPath, "utf8");
    } else {
      const rawBaseUrl = process.env.FRONTEND_URL || "https://daw.co.id";
      const baseUrl = rawBaseUrl.replace(/\/$/, "");
      return `# Dynamic robots.txt
User-agent: *
Disallow: /api/
Disallow: /uploads/
Allow: /robots.txt
Allow: /sitemap.xml

Sitemap: ${baseUrl}/sitemap.xml`;
    }
  }

  async updateRobotsContent(content) {
    if (content === undefined) throw new Error("VALIDATION_ERROR: Content cannot be empty");
    
    const robotsPath = path.join(process.cwd(), "public", "robots.txt");
    const publicDir = path.join(process.cwd(), "public");
    
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    fs.writeFileSync(robotsPath, content, "utf8");
    return { success: true };
  }
  */
}

module.exports = new SitemapService();
