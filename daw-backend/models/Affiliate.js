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

module.exports = Affiliate;
