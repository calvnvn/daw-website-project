const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Setting = sequelize.define(
  "Setting",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    googleMapsUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    linkedinUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "settings",
    timestamps: true,
  },
);

module.exports = Setting;
