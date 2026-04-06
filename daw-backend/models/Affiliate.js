const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Affiliate = sequelize.define("Affiliate", {
  name: { type: DataTypes.STRING, allowNull: false },
  desc: { type: DataTypes.STRING },
  category: {
    type: DataTypes.ENUM("fnb", "steel", "finance", "edu"),
    defaultValue: "fnb",
  },
  websiteUrl: {
    type: DataTypes.STRING,
    field: "website_url",
  },
  logoUrl: { type: DataTypes.STRING },
});

module.exports = Affiliate;
