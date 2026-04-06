const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const InquirySubject = sequelize.define(
  "InquirySubject",
  {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    recipient_email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },

    is_redirect: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    redirect_url: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
  },
  {
    tableName: "InquirySubjects",
  },
);

module.exports = InquirySubject;
