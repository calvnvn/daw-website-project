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
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
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
      type: DataTypes.STRING(255),
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
    seo_title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meta_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Status apakah data sedang dalam proses approval",
    },
    lock_ticket: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Menyimpan No. Tiket dari OWL yang sedang mengunci data ini",
    },
  },
  {
    timestamps: true,
  },
);
module.exports = Project;
