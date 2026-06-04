const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AffiliateCategory = sequelize.define("AffiliateCategory", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: "Briefcase",
  },
  is_locked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lock_ticket: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});

module.exports = AffiliateCategory;
