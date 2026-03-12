const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Inquiry = sequelize.define("Inquiry", {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  company: { type: DataTypes.STRING },
  subject: { type: DataTypes.STRING, defaultValue: "General Inquiry" },
  message: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = Inquiry;
