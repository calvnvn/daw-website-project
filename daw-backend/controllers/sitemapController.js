const Page = require("../models/Page");
const Project = require("../models/Project");

exports.generateSitemap = async (req, res) => {
  try {
    // Ambil domain dari .env, jika tidak ada pakai dev-web
    const baseUrl = process.env.FRONTEND_URL || "https://dev-web.daw.co.id";

    // 1. Ambil semua Page (Slug)
    const pages = await Page.findAll({
      attributes: ["slug", "updatedAt"],
    });

    // 2. Ambil semua Project yang 'Published'
    const projects = await Project.findAll({
      where: { status: "Published" },
      attributes: ["id", "updatedAt"], // Pakai id sesuai frontend kamu saat ini
    });

    // 3. Daftar Route Statis (Halaman yang pasti ada)
    const staticRoutes = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/about", priority: "0.8", changefreq: "weekly" },
      { url: "/businesses", priority: "0.8", changefreq: "weekly" },
      { url: "/contact-us", priority: "0.7", changefreq: "monthly" },
    ];

    // 4. Bangun XML String
    let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Tambahkan Static Routes
    staticRoutes.forEach((route) => {
      xml += `
  <url>
    <loc>${baseUrl}${route.url}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
    });

    // Tambahkan Dynamic Pages (Halaman dari Page Builder)
    pages.forEach((page) => {
      xml += `
  <url>
    <loc>${baseUrl}/page/${page.slug}</loc>
    <lastmod>${page.updatedAt.toISOString().split("T")[0]}</lastmod>
    <priority>0.6</priority>
  </url>`;
    });

    // Tambahkan Dynamic Projects
    projects.forEach((project) => {
      xml += `
  <url>
    <loc>${baseUrl}/projects/${project.id}</loc>
    <lastmod>${project.updatedAt.toISOString().split("T")[0]}</lastmod>
    <priority>0.6</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    // Kirim sebagai XML
    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (error) {
    console.error("🚨 SITEMAP ERROR:", error);
    res.status(500).send("Error generating sitemap");
  }
};
