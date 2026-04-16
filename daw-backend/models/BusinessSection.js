const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * BusinessSection Model
 * Defines the schema for a major business unit (e.g., Resources, Energy).
 * Uses a string-based ID (slug) to facilitate dynamic routing and tab identification.
 */
const BusinessSection = sequelize.define(
  "BusinessSection",
  {
    // Primary Key: Slug format (e.g., 'renewable-energy')
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false,
    },
    // Display Label for the sector (e.g., 'Renewable Energy')
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The main headline or subtitle for the section
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Editorial content stored in HTML format from Rich Text Editor
    htmlContent: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    // Toggle to determine if the Interactive Map should be rendered
    hasMap: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Defines the sequence of display in the frontend navigation
    orderIndex: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Status apakah data sedang dalam proses approval",
    },
    lock_ticket: {
      type: DataTypes.STRING(255),
      allowNull: true, // Perbaikan dari allowValue
    },
  },
  {
    // Automatic management of createdAt and updatedAt fields
    timestamps: true,
  },
);

module.exports = BusinessSection;
