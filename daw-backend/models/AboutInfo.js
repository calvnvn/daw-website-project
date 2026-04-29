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
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Status apakah data sedang dalam proses approval",
    },
    lock_ticket: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Menyimpan No. Tiket dari OWL",
    },
  },
  {
    tableName: "AboutInfo",
    freezeTableName: true,
    timestamps: true,
  },
);

module.exports = AboutInfo;
