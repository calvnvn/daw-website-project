const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ApprovalDraft = sequelize.define("ApprovalDraft", {
  notrans: {
    type: DataTypes.STRING(255),
    primaryKey: true, // PK mengikuti nomor tiket dari OWL
    allowNull: false,
  },
  module_name: {
    type: DataTypes.STRING(50), 
    allowNull: false,
  },
  target_id: {
    type: DataTypes.STRING(50), // ID baris data yang mau diubah
    allowNull: true, // Bisa null jika modulnya Singleton (ID=1)
  },
  payload: {
    type: DataTypes.JSON, // Menyimpan seluruh data revisi
    allowNull: false,
  },
  created_by: {
    type: DataTypes.STRING(255), // NIK atau Username Editor
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("Pending", "Approved", "Rejected"),
    defaultValue: "Pending",
  }
}, {
  timestamps: true, 
});

module.exports = ApprovalDraft;