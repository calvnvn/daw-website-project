const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const NewsArticle = sequelize.define(
  "NewsArticle",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    excerpt: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Short summary displayed on cards and SEO snippets",
    },
    content: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      comment: "WYSIWYG HTML content (same engine as Dynamic Page)",
    },
    category_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: "FK to NewsCategories table",
    },
    status: {
      type: DataTypes.ENUM("Draft", "Published"),
      defaultValue: "Draft",
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cover_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Explicit publish timestamp for editorial scheduling",
    },
    read_time: {
      type: DataTypes.STRING(30),
      allowNull: true,
      comment: "Estimated reading duration, e.g. '5 min read'",
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    seo_title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meta_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "Status apakah data sedang dalam proses approval",
    },
    lock_ticket: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: "Menyimpan No. Tiket dari OWL yang sedang mengunci data ini",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = NewsArticle;
