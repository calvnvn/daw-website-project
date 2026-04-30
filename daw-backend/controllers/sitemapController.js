const Page = require("../models/Page");
const Project = require("../models/Project");

exports.generateSitemap = async (req, res) => {
  try {
    const rawBaseUrl =
      process.env.FRONTEND_URL || "[https://daw.co.id](https://daw.co.id)";
    const baseUrl = rawBaseUrl.replace(/\/$/, "");

    const pages = await Page.findAll({
      attributes: ["slug", "updatedAt"],
    });

    const projects = await Project.findAll({
      where: { status: "Published" },
      attributes: ["slug", "updatedAt"],
    });

    const staticRoutes = [
      { url: "/", priority: "1.0", changefreq: "daily" },
      { url: "/businesses", priority: "0.9", changefreq: "weekly" },
      { url: "/about", priority: "0.8", changefreq: "weekly" },
      { url: "/contact-us", priority: "0.7", changefreq: "monthly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="[http://www.sitemaps.org/schemas/sitemap/0.9](http://www.sitemaps.org/schemas/sitemap/0.9)">\n`;

    const today = new Date().toISOString().split("T")[0];

    staticRoutes.forEach((route) => {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${route.url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

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

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (error) {
    console.error("🚨 SITEMAP ERROR:", error);
    res.status(500).send("Error generating sitemap");
  }
};
