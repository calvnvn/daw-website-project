const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const InvestmentSettings = sequelize.define("InvestmentSettings", {
  teaserHeadline: {
    type: DataTypes.STRING,
    defaultValue: "Other Investments.",
  },
  teaserBody: { type: DataTypes.TEXT },
  sectionIntro: { type: DataTypes.TEXT },
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

module.exports = InvestmentSettings;
