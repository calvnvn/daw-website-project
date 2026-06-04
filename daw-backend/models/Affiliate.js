const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Affiliate = sequelize.define("Affiliate", {
  name: { type: DataTypes.STRING, allowNull: false },
  desc: { type: DataTypes.STRING },
  category: {
    type: DataTypes.STRING,
    defaultValue: "Other",
    comment: "Legacy column – akan di-deprecate setelah migrasi ke category_id selesai",
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "FK ke tabel AffiliateCategories",
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
