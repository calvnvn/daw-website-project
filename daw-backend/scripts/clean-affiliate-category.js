const sequelize = require("../config/database");
const Translation = require("../models/Translation");

async function clean() {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully.");

    const count = await Translation.destroy({
      where: {
        modelName: "Affiliate",
        field: "category"
      }
    });

    console.log(`Successfully deleted ${count} bad affiliate category translations from database!`);
    process.exit(0);
  } catch (error) {
    console.error("Failed to clean database:", error);
    process.exit(1);
  }
}

clean();
