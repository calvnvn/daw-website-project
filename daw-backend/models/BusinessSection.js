const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BusinessSection = sequelize.define(
  "BusinessSection",
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    htmlContent: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    hasMap: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = BusinessSection;
