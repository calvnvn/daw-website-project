const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ImpactStats = sequelize.define("ImpactStats", {
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
});

module.exports = ImpactStats;
