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
    companyName: {
      type: DataTypes.STRING(255),
      field: "companyName",
    },
    address: {
      type: DataTypes.TEXT,
      field: "address",
    },
    phone: {
      type: DataTypes.STRING(50),
      field: "phone",
    },
    email: {
      type: DataTypes.STRING(100),
      field: "email",
    },
    website: {
      type: DataTypes.STRING(100),
      field: "website",
    },
    googleMapsUrl: {
      type: DataTypes.TEXT,
      field: "googleMapsUrl",
    },
    linkedinUrl: {
      type: DataTypes.STRING(255),
      field: "linkedinUrl",
    },
    logoUrl: {
      type: DataTypes.STRING(255),
      field: "logoUrl",
    },
    faviconUrl: {
      type: DataTypes.STRING(255),
      field: "faviconUrl",
    },
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
  },
  {
    tableName: "Settings",
    freezeTableName: true,
    timestamps: true,
    underscored: false,
  },
);

module.exports = Settings;
