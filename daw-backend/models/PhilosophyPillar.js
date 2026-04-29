const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PhilosophyPillar = sequelize.define(
  "PhilosophyPillar",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    iconId: { type: DataTypes.STRING, defaultValue: "human" },
    title: { type: DataTypes.STRING },
    text: { type: DataTypes.TEXT },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
    is_locked: { type: DataTypes.BOOLEAN, defaultValue: false },
    lock_ticket: { type: DataTypes.STRING, allowNull: true },
  },
  {
    tableName: "PhilosophyPillars",
    timestamps: true,
  },
);

module.exports = PhilosophyPillar;
