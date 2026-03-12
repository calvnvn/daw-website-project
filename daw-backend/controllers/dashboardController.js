const sequelize = require("../config/database");

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Hitung pesan yang belum dibaca (Unread Inquiries)
    const [inquiryResult] = await sequelize.query(
      "SELECT COUNT(*) as unreadCount FROM Inquiries WHERE isRead = false OR isRead = 0",
      { type: sequelize.QueryTypes.SELECT },
    );

    // 2. Hitung jumlah project Draft dan Total Views keseluruhan
    const [projectResult] = await sequelize.query(
      `SELECT 
        SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draftCount,
        SUM(views) as totalViews
       FROM Projects`,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 3. Ambil 4 pesan terbaru yang belum dibaca untuk ditampilkan di Dashboard
    const recentInquiries = await sequelize.query(
      `SELECT id, name, company, subject, message, createdAt 
       FROM Inquiries 
       WHERE isRead = false OR isRead = 0 
       ORDER BY createdAt DESC 
       LIMIT 4`,
      { type: sequelize.QueryTypes.SELECT },
    );

    // 4. Parsing data agar aman (jika database kosong, kembalikan 0, bukan null)
    const unreadCount = parseInt(inquiryResult?.unreadCount) || 0;
    const draftCount = parseInt(projectResult?.draftCount) || 0;
    const totalViews = parseInt(projectResult?.totalViews) || 0;

    // 5. Susun Response JSON
    res.status(200).json({
      success: true,
      data: {
        stats: {
          unreadInquiries: unreadCount,
          draftProjects: draftCount,
          totalViews: totalViews,
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
