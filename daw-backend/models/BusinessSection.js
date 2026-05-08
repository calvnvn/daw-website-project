const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BusinessSection = sequelize.define(
  "BusinessSection",
  {
    id: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false,
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
      allowNull: true, 
    },
  },
  {
    timestamps: true,
  },
);

module.exports = BusinessSection;
