const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Philosophy = sequelize.define(
  "Philosophy",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    philosophyTitle: { type: DataTypes.STRING(255) },
    is_locked: { type: DataTypes.BOOLEAN, defaultValue: false },
    lock_ticket: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: "Philosophies",
    freezeTableName: true,
    timestamps: true,
  },
);

module.exports = Philosophy;
