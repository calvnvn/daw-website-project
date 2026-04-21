const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MapCategory = sequelize.define(
  "MapCategory",
  {
    id: {
      type: DataTypes.STRING(50), // primary key, misal: 'direct'
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100), // Label: 'DAW Direct'
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING(7), // Hex: '#004B23'
      defaultValue: "#004B23",
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lock_ticket: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "MapCategories",
    timestamps: true,
  },
);

module.exports = MapCategory;
