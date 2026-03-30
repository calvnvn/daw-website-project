const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AboutInfo = sequelize.define(
  "AboutInfo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    spiritText: { type: DataTypes.TEXT },
    missionText: { type: DataTypes.TEXT },
    visionText: { type: DataTypes.TEXT },
    philosophyTitle: { type: DataTypes.STRING(255) },
    philosophyPillars: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "AboutInfo",
    freezeTableName: true,
    timestamps: true,
  },
);

module.exports = AboutInfo;
