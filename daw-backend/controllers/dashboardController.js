const dashboardService = require("../services/dashboardService");

// Aggregates platform-wide metrics and recent activities for the administrative dashboard.
exports.getDashboardStats = async (req, res) => {
  const role = req.userRole?.toLowerCase() || "editor";
  const actorId = String(req.karyawanId || req.owl_username);

  try {
    const data = await dashboardService.getDashboardData(role, actorId);

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
