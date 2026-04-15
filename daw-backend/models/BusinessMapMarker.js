const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BusinessMapMarker = sequelize.define(
  "BusinessMapMarker",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    desc: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      references: {
        model: "MapCategories",
        key: "id",
      },
    },
    dotX: { type: DataTypes.STRING, allowNull: false },
    dotY: { type: DataTypes.STRING, allowNull: false },
    boxX: { type: DataTypes.STRING, allowNull: false },
    boxY: { type: DataTypes.STRING, allowNull: false },
    mapUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sectionId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // 🚀 TAMBAHKAN DUA KOLOM INI:
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lock_ticket: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "BusinessMapMarkers",
    timestamps: true,
  },
);

module.exports = BusinessMapMarker;
