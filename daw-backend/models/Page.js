const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Page = sequelize.define("Page", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subtitle: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  heroImage: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
  },
  templateType: {
    type: DataTypes.ENUM("classic", "modern", "split"),
    defaultValue: "classic",
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  content: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
  },
  metaDescription: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = Page;
