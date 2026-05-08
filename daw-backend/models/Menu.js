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
    defaultValue: 0,
  },
  type: {
    type: DataTypes.ENUM("page", "external", "folder"),
    defaultValue: "page",
  },
  pageId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  externalLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isActive: {
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
