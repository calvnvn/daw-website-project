const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Settings = sequelize.define(
  "Settings",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyName: { type: DataTypes.STRING(255) },
    address: { type: DataTypes.TEXT },
    phone: { type: DataTypes.STRING(50) },
    email: { type: DataTypes.STRING(100) },
    website: { type: DataTypes.STRING(100) },
    googleMapsUrl: { type: DataTypes.TEXT },
    linkedinUrl: { type: DataTypes.STRING(255) },
    logoUrl: { type: DataTypes.STRING(255) },
    faviconUrl: { type: DataTypes.STRING(255) },
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
  },
  {
    tableName: "Settings",
    freezeTableName: true,
    timestamps: true,
  },
);

module.exports = Settings;
