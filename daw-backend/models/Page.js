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
    type: DataTypes.STRING,
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
  sidebarLinks: {
    type: DataTypes.JSON,
    defaultValue: [],
    allowNull: true,
  },
  showDropCap: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  is_locked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "Status apakah data sedang dalam proses approval",
  },
  lock_ticket: {
    type: DataTypes.STRING,
    allowValue: true,
    comment: "Menyimpan No. Tiket dari OWL yang sedang mengunci data ini",
  },
});

module.exports = Page;
