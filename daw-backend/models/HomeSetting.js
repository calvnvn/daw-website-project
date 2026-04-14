const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HomeSetting = sequelize.define("HomeSetting", {
  introHeadline: {
    type: DataTypes.STRING,
  },
  introBody: {
    type: DataTypes.TEXT,
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

module.exports = HomeSetting;
