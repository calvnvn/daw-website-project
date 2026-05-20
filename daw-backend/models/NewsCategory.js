const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NewsCategory = sequelize.define(
  "NewsCategory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "Display name, e.g. 'Company News', 'Press Release'",
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: "URL-safe identifier, e.g. 'company-news'",
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "#004B23",
      comment: "Badge color hex for frontend display",
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Sort priority in admin and public views",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = NewsCategory;
