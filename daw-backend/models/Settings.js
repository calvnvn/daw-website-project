const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Settings = sequelize.define(
  "Settings",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyName: { type: DataTypes.STRING(255) },
    address: { type: DataTypes.TEXT },
    phone: { type: DataTypes.STRING(50) },
    email: { type: DataTypes.STRING(100) },
    website: { type: DataTypes.STRING(100) },
    googleMapsUrl: { type: DataTypes.TEXT },
    linkedinUrl: { type: DataTypes.STRING(255) },
  },
  {
    tableName: "Settings",
    freezeTableName: true,
    timestamps: true,
  },
);

module.exports = Settings;
