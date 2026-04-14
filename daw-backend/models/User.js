const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const bcrypt = require("bcryptjs");

const User = sequelize.define(
  "User",
  {
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
      unique: {
        name: "daw_email",
        msg: "Email already in use.",
      },
      validate: { isEmail: true },
    },
    // Identitas OWL dari post uname
    owl_username: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      comment: "Username/NIK dari ERP OWL untuk SSO",
    },
    // Password bisa null karena verifikasinya lewat owl
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("Superadmin", "Editor", "Approver"),
      defaultValue: "Editor",
    },
    status: {
      type: DataTypes.ENUM("Active", "Suspended"),
      defaultValue: "Active",
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password && !user.password.startsWith("$2")) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (
          user.changed("password") &&
          user.password &&
          !user.password.startsWith("$2")
        ) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  },
);

module.exports = User;
