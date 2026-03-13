const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BusinessMapMarker = sequelize.define(
  "BusinessMapMarker",
  {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    desc: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("direct", "tudung"),
      allowNull: false,
    },
    dotX: { type: DataTypes.STRING, allowNull: false }, // contoh: "18%"
    dotY: { type: DataTypes.STRING, allowNull: false }, // contoh: "49%"
    boxX: { type: DataTypes.STRING, allowNull: false },
    boxY: { type: DataTypes.STRING, allowNull: false },
  },
  {
    timestamps: true,
  },
);

module.exports = BusinessMapMarker;
