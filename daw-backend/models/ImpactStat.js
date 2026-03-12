const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ImpactStat = sequelize.define("ImpactStat", {
  icon: {
    type: DataTypes.STRING,
    defaultValue: "Map",
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  desc: {
    type: DataTypes.TEXT,
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = ImpactStat;
