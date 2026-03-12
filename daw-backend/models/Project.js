const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Project = sequelize.define(
  "Project",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    excerpt: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM("Resources", "Energy"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("Draft", "Published"),
      defaultValue: "Draft",
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cover_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gallery: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
  },
);
module.exports = Project;
