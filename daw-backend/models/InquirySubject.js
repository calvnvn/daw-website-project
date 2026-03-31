const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const InquirySubject = sequelize.define("InquirySubject", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = InquirySubject;
