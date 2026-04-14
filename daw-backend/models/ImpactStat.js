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

module.exports = ImpactStat;
