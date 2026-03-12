const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const InvestmentSetting = sequelize.define("InvestmentSetting", {
  teaserHeadline: {
    type: DataTypes.STRING,
    defaultValue: "Other Investments.",
  },
  teaserBody: { type: DataTypes.TEXT },
  sectionIntro: { type: DataTypes.TEXT },
});

module.exports = InvestmentSetting;
