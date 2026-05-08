const sequelize = require("../config/database");

/**
 * Aggregates platform-wide metrics and recent activities for the administrative dashboard.
 * Executes read-only raw SQL queries for optimized metric calculations.
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Aggregate unread inquiry count
    const [inquiryResult] = await sequelize.query(
      "SELECT COUNT(*) as unreadCount FROM Inquiries WHERE isRead = false OR isRead = 0",
      { type: sequelize.QueryTypes.SELECT },
    );

    // Calculate global project metrics (drafts and total views)
    const [projectResult] = await sequelize.query(
      `SELECT 
        SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draftCount,
        SUM(views) as totalViews
       FROM Projects`,
      { type: sequelize.QueryTypes.SELECT },
    );

    // Map project distribution across business categories via left join
    const projectDistribution = await sequelize.query(
      `SELECT 
        bs.category as label, 
        COUNT(p.id) as value 
       FROM BusinessSections bs
       LEFT JOIN Projects p ON p.category = bs.id
       GROUP BY bs.id, bs.category
       ORDER BY value DESC`,
      { type: sequelize.QueryTypes.SELECT },
    );

    // Retrieve latest unread inquiries for quick access
    const recentInquiries = await sequelize.query(
      `SELECT id, name, company, subject, message, createdAt 
       FROM Inquiries 
       WHERE isRead = false OR isRead = 0 
       ORDER BY createdAt DESC 
       LIMIT 4`,
      { type: sequelize.QueryTypes.SELECT },
    );

    // Normalize null results to zero for safe frontend consumption
    const unreadCount = parseInt(inquiryResult?.unreadCount) || 0;
    const draftCount = parseInt(projectResult?.draftCount) || 0;
    const totalViews = parseInt(projectResult?.totalViews) || 0;

    // Construct and transmit unified JSON payload
    res.status(200).json({
      success: true,
      data: {
        stats: {
          unreadInquiries: unreadCount,
          draftProjects: draftCount,
          totalViews: totalViews,
          projectDistribution: projectDistribution,
        },
        recentInquiries: recentInquiries,
      },
    });
  } catch (error) {
    console.error("[DASHBOARD STATS ERROR]:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data.",
    });
  }
};
