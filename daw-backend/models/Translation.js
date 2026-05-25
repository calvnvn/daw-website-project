const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Translation = sequelize.define(
  "Translation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    modelName: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    recordId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    field: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    locale: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    translatedText: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["modelName", "recordId", "field", "locale"],
      },
    ],
  },
);
module.exports = Translation;
