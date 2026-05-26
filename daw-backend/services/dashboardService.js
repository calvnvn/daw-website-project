const sequelize = require("../config/database");
const ApprovalDraft = require("../models/ApprovalDraft");
const NewsArticle = require("../models/NewsArticle");

class DashboardService {
  /**
   * Generates general statistics for the dashboard, including unread inquiries,
   * draft projects, total views, and project distribution across categories.
   */
  async getGeneralStats() {
    const [inquiryResult] = await sequelize.query(
      "SELECT COUNT(*) as unreadCount FROM Inquiries WHERE isRead = false OR isRead = 0",
      { type: sequelize.QueryTypes.SELECT },
    );
    const [projectResult] = await sequelize.query(
      "SELECT SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draftCount, SUM(views) as totalViews FROM Projects",
      { type: sequelize.QueryTypes.SELECT },
    );
    const projectDistribution = await sequelize.query(
      "SELECT bs.category as label, COUNT(p.id) as value FROM BusinessSections bs LEFT JOIN Projects p ON p.category = bs.id GROUP BY bs.id, bs.category ORDER BY value DESC",
      { type: sequelize.QueryTypes.SELECT },
    );

    const newsTotalViewsResult = (await NewsArticle.sum("views")) || 0;

    return {
      unreadInquiries: parseInt(inquiryResult?.unreadCount) || 0,
      draftProjects: parseInt(projectResult?.draftCount) || 0,
      totalViews:
        (parseInt(projectResult?.totalViews) || 0) + newsTotalViewsResult,
      projectDistribution: projectDistribution,
    };
  }

  /**
   * Retrieves the most recent unread inquiries.
   */
  async getRecentInquiries() {
    return await sequelize.query(
      "SELECT id, name, company, subject, message, createdAt FROM Inquiries WHERE isRead = false OR isRead = 0 ORDER BY createdAt DESC LIMIT 4",
      { type: sequelize.QueryTypes.SELECT },
    );
  }

  // Aggregates platform-wide metrics and recent activities customized by role.
  async getDashboardData(role, actorId) {
    const data = {};

    if (role === "approver") {
      data.pendingApprovals = await ApprovalDraft.findAll({
        where: { status: "Pending" },
        limit: 10,
        order: [["createdAt", "DESC"]],
      });
    } else if (role === "editor") {
      data.stats = await this.getGeneralStats();
      data.recentInquiries = await this.getRecentInquiries();

      data.myDrafts = await ApprovalDraft.findAll({
        where: { created_by: actorId },
        limit: 10,
        order: [["createdAt", "DESC"]],
      });

      data.topNews = await NewsArticle.findAll({
        where: { status: "Published" },
        order: [["views", "DESC"]],
        attributes: ["id", "title", "views", "slug"],
        limit: 3,
      });
    } else {
      data.stats = await this.getGeneralStats();
      data.recentInquiries = await this.getRecentInquiries();

      data.activeStaging = await ApprovalDraft.findAll({
        where: { status: ["Pending", "Rejected", "Approved"] },
        limit: 10,
        order: [["createdAt", "DESC"]],
      });

      data.topNews = await NewsArticle.findAll({
        where: { status: "Published" },
        order: [["views", "DESC"]],
        attributes: ["id", "title", "views", "slug"],
        limit: 3,
      });
    }

    return data;
  }
}

module.exports = new DashboardService();
