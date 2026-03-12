const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HomeSetting = sequelize.define("HomeSetting", {
  introHeadline: {
    type: DataTypes.STRING,
  },
  introBody: {
    type: DataTypes.TEXT,
  },
});

module.exports = HomeSetting;
