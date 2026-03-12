const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Management = sequelize.define(
  "Management",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    level: {
      type: DataTypes.ENUM("chairman", "director", "division"),
      allowNull: false,
      defaultValue: "division",
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    photoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "Managements",
    timestamps: true,
  },
);

module.exports = Management;
