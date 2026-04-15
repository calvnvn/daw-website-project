// models/User.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  owl_username: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Nullable karena login via OWL
  },
  status: {
    type: DataTypes.ENUM("Active", "Suspended"),
    defaultValue: "Active",
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, { timestamps: true });

module.exports = User;