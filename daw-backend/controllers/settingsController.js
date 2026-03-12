const sequelize = require("../config/database");

// --- 1. GET Data Settings ---
exports.getSettings = async (req, res) => {
  try {
    const [settings] = await sequelize.query(
      "SELECT * FROM Settings WHERE id = 1 LIMIT 1",
      { type: sequelize.QueryTypes.SELECT },
    );

    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error GET Settings:", error);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};

// --- 2. PUT Data Settings ---
exports.updateSettings = async (req, res) => {
  try {
    const {
      companyName,
      address,
      phone,
      email,
      website,
      googleMapsUrl,
      linkedinUrl,
    } = req.body;

    const updateQuery = `
      UPDATE Settings 
      SET 
        companyName = :companyName,
        address = :address, 
        phone = :phone, 
        email = :email, 
        website = :website, 
        googleMapsUrl = :googleMapsUrl, 
        linkedinUrl = :linkedinUrl,
        updatedAt = NOW()
      WHERE id = 1
    `;

    await sequelize.query(updateQuery, {
      replacements: {
        companyName: companyName || "",
        address: address || "",
        phone: phone || "",
        email: email || "",
        website: website || "",
        googleMapsUrl: googleMapsUrl || "",
        linkedinUrl: linkedinUrl || "",
      },
      type: sequelize.QueryTypes.UPDATE,
    });

    res.status(200).json({ message: "Global settings updated successfully!" });
  } catch (error) {
    console.error("Error UPDATE Settings:", error);
    res.status(500).json({ message: "Failed to update settings" });
  }
};
