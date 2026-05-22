const sequelize = require("../config/database");
const ApprovalDraft = require("../models/ApprovalDraft");
const NewsArticle = require("../models/NewsArticle");

/**
 * Aggregates platform-wide metrics and recent activities for the administrative dashboard.
 * Executes optimized metric calculations and tailors payload based on strict RBAC roles.
 */
exports.getDashboardStats = async (req, res) => {
  const role = req.userRole?.toLowerCase() || "editor";
  const actorId = String(req.karyawanId || req.owl_username);

  try {
    const data = {};

    // Helper functions for shared queries
    const getGeneralStats = async () => {
      const [inquiryResult] = await sequelize.query(
        "SELECT COUNT(*) as unreadCount FROM Inquiries WHERE isRead = false OR isRead = 0",
        { type: sequelize.QueryTypes.SELECT }
      );
      const [projectResult] = await sequelize.query(
        "SELECT SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draftCount, SUM(views) as totalViews FROM Projects",
        { type: sequelize.QueryTypes.SELECT }
      );
      const projectDistribution = await sequelize.query(
        "SELECT bs.category as label, COUNT(p.id) as value FROM BusinessSections bs LEFT JOIN Projects p ON p.category = bs.id GROUP BY bs.id, bs.category ORDER BY value DESC",
        { type: sequelize.QueryTypes.SELECT }
      );

      // News total views calculation
      const newsTotalViewsResult = await NewsArticle.sum('views') || 0;

      return {
        unreadInquiries: parseInt(inquiryResult?.unreadCount) || 0,
        draftProjects: parseInt(projectResult?.draftCount) || 0,
        totalViews: (parseInt(projectResult?.totalViews) || 0) + newsTotalViewsResult,
        projectDistribution: projectDistribution,
      };
    };

    const getRecentInquiries = async () => {
      return await sequelize.query(
        "SELECT id, name, company, subject, message, createdAt FROM Inquiries WHERE isRead = false OR isRead = 0 ORDER BY createdAt DESC LIMIT 4",
        { type: sequelize.QueryTypes.SELECT }
      );
    };

    // 1. APPROVER VIEW
    if (role === "approver") {
      data.pendingApprovals = await ApprovalDraft.findAll({
        where: { status: "Pending" },
        limit: 10,
        order: [["createdAt", "DESC"]],
      });
      // Approvers do not receive stats or inbox
    } 
    // 2. EDITOR VIEW
    else if (role === "editor") {
      data.stats = await getGeneralStats();
      data.recentInquiries = await getRecentInquiries();
      
      // Editor's specific submitted drafts
      data.myDrafts = await ApprovalDraft.findAll({
        where: { created_by: actorId },
        limit: 10,
        order: [["createdAt", "DESC"]],
      });
      
      // Top performing news for insight
      data.topNews = await NewsArticle.findAll({
        where: { status: "Published" },
        order: [["views", "DESC"]],
        attributes: ["id", "title", "views", "slug"],
        limit: 3
      });
    } 
    // 3. SUPERADMIN / ADMIN VIEW
    else {
      data.stats = await getGeneralStats();
      data.recentInquiries = await getRecentInquiries();
      
      // Overall staging overview (read-only monitoring)
      data.activeStaging = await ApprovalDraft.findAll({
        where: { status: ["Pending", "Rejected", "Approved"] },
        limit: 10,
        order: [["createdAt", "DESC"]],
      });
      
      // Top performing news for insight
      data.topNews = await NewsArticle.findAll({
        where: { status: "Published" },
        order: [["views", "DESC"]],
        attributes: ["id", "title", "views", "slug"],
        limit: 3
      });
    }

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[DASHBOARD STATS ERROR]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data.",
    });
  }
};
