const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ApprovalDraft = sequelize.define(
  "ApprovalDraft",
  {
    notrans: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false,
    },
    module_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    action: {
      type: DataTypes.ENUM("CREATE", "UPDATE", "DELETE"),
      allowNull: false,
    },
    target_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("Pending", "Approved", "Rejected"),
      defaultValue: "Pending",
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = ApprovalDraft;
