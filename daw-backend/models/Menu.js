const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Page = require("./Page");

const Menu = sequelize.define("Menu", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  parentId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  orderIndex: {
    type: DataTypes.INTEGER,
    defaultValue: 0, // Drag & Drop order
  },
  type: {
    type: DataTypes.ENUM("page", "external"),
    defaultValue: "page",
  },
  pageId: {
    type: DataTypes.UUID,
    allowNull: true, // Akan terisi ID dari tabel Page jika type === "page"
  },
  externalLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true, // Fitur hide/show menu tanpa harus menghapusnya
  },
});

// Self-Referencing Menu
Menu.hasMany(Menu, {
  as: "children",
  foreignKey: "parentId",
  onDelete: "CASCADE",
});
Menu.belongsTo(Menu, { as: "parent", foreignKey: "parentId" });

// Menu To Page Relation (1:1)
Page.hasMany(Menu, { foreignKey: "pageId", onDelete: "SET NULL" });
Menu.belongsTo(Page, { foreignKey: "pageId" });

module.exports = Menu;
