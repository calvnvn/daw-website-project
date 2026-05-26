const sitemapService = require("../services/sitemapService");

exports.generateSitemap = async (req, res) => {
  try {
    const xml = await sitemapService.generateSitemap();
    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (error) {
    console.error("🚨 SITEMAP ERROR:", error);
    res.status(500).send("Error generating sitemap");
  }
};

exports.generateRobotsTxt = async (req, res) => {
  try {
    const content = await sitemapService.generateRobotsTxt();
    res.type("text/plain");
    res.status(200).send(content);
  } catch (error) {
    console.error("🚨 ROBOTS.TXT GENERATION ERROR:", error);
    res.status(500).send("Error serving robots.txt");
  }
};

exports.getRobotsContent = async (req, res) => {
  try {
    const content = await sitemapService.getRobotsContent();
    res.status(200).json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRobotsContent = async (req, res) => {
  try {
    await sitemapService.updateRobotsContent(req.body.content);
    res.status(200).json({ success: true, message: "robots.txt successfully updated!" });
  } catch (error) {
    if (error.message.startsWith("VALIDATION_ERROR")) {
      return res.status(400).json({ success: false, message: error.message.split(": ")[1] });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
