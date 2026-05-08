const { Sequelize } = require("sequelize");
const path = require("path");

// Load environment variables from a specific absolute path to ensure cross-directory compatibility
require("dotenv").config({ path: path.join(__dirname, "../.env") });

/**
 * Initialize Sequelize ORM instance with MySQL dialect and connection pooling configuration.
 * Consumes DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, and DB_PORT from environment variables.
 */
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    port: process.env.DB_PORT || 3306,
    logging: false,
  },
);

module.exports = sequelize;
