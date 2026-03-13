const BusinessSection = require("../models/BusinessSection");

const seedBusinesses = async () => {
  try {
    const data = [
      {
        id: "resources",
        category: "Resources",
        title: "Resources Focus",
        htmlContent:
          "<h2>Initial Resources Content</h2><p>Please edit this in Admin Panel.</p>",
        hasMap: true,
      },
      {
        id: "energy",
        category: "Energy",
        title: "Energy Focus",
        htmlContent:
          "<h2>Initial Energy Content</h2><p>Please edit this in Admin Panel.</p>",
        hasMap: true,
      },
    ];

    // Menggunakan findOrCreate agar tidak duplikat kalau server restart
    for (const item of data) {
      await BusinessSection.findOrCreate({
        where: { id: item.id },
        defaults: item,
      });
    }

    console.log("✅ Business sections seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding business sections:", error);
  }
};

module.exports = seedBusinesses;
