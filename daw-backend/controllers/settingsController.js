const sequelize = require("../config/database");
const { deleteSingleFile } = require("../utils/fileRemover");

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
    // 1. Ambil data lama dulu buat ngecek path gambar (biar nggak hilang kalau cuma edit text)
    const [oldData] = await sequelize.query(
      "SELECT logoUrl, faviconUrl FROM Settings WHERE id = 1 LIMIT 1",
      { type: sequelize.QueryTypes.SELECT },
    );

    const {
      companyName,
      address,
      phone,
      email,
      website,
      googleMapsUrl,
      linkedinUrl,
    } = req.body;

    // 2. Setup Default Value gambar (Pakai yang lama kalau nggak ada file baru)
    let newLogoUrl = oldData?.logoUrl || "";
    let newFaviconUrl = oldData?.faviconUrl || "";

    // 3. Tangkap File Baru (Jika Di-upload)
    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        deleteSingleFile(oldData?.logoUrl);
        newLogoUrl = req.files.logo[0].filename;
      }
      if (req.files.favicon && req.files.favicon[0]) {
        deleteSingleFile(oldData?.faviconUrl);
        newFaviconUrl = req.files.favicon[0].filename;
      }
    }

    // 4. Eksekusi Update Query
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
        logoUrl = :logoUrl,
        faviconUrl = :faviconUrl,
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
        logoUrl: newLogoUrl,
        faviconUrl: newFaviconUrl,
      },
      type: sequelize.QueryTypes.UPDATE,
    });

    res.status(200).json({
      message: "Global settings updated successfully!",
      logoUrl: newLogoUrl,
      faviconUrl: newFaviconUrl,
    });
  } catch (error) {
    console.error("Error UPDATE Settings:", error);
    res.status(500).json({ message: "Failed to update settings" });
  }
};
