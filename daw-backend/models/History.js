const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const History = sequelize.define(
  "History",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    year: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    lock_ticket: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "Histories",
    freezeTableName: true,
    timestamps: true,
    hooks: {
      beforeBulkUpdate: (options) => {
        if (options.where && options.where.id === "ALL_TIMELINE") {
          console.log(
            "🚀 [HISTORY HOOK] Intercepting 'ALL_TIMELINE' lock request...",
          );

          options.where = {};

          options.limit = null;
        }
      },
    },
  },
);

module.exports = History;
