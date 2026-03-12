const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const HeroSlide = sequelize.define("HeroSlide", {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subtitle: {
    type: DataTypes.TEXT,
  },
  imageUrl: {
    type: DataTypes.STRING,
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = HeroSlide;
