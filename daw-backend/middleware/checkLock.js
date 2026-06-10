const AboutInfo = require("../models/AboutInfo");
const BusinessSection = require("../models/BusinessSection");
const History = require("../models/History");
const Management = require("../models/Management");
const Page = require("../models/Page");
const Project = require("../models/Project");
const NewsArticle = require("../models/NewsArticle");

/**
 * Higher-order middleware for pessimistic concurrency control based on record state.
 * Validates resource availability before allowing mutative operations in the controller.
 */
const checkLock = (Model) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const userRole = req.userRole;

      // Implement administrative override to bypass synchronization locks
      if (userRole === "superadmin" || userRole === "owner") {
        return next();
      }

      // Retrieve production record metadata to verify current lock status
      const record = await Model.findByPk(id);

      // Delegate non-existent record handling (404) to the primary controller
      if (!record) {
        return next();
      }

      // Validate data availability; prevents concurrent modifications during active approval cycles
      if (record.is_locked) {
        return res.status(423).json({
          message: "Data sedang dikunci (Locked).",
          error: `Perubahan ditolak karena data ini sedang dalam proses review (Tiket: ${record.lock_ticket || "N/A"}).`,
          lockTicket: record.lock_ticket,
        });
      }

      // Proceed to the next middleware or controller if the resource is unlocked
      next();
    } catch (error) {
      console.error("🚨 Error pada checkLock Middleware:", error.message);
      res
        .status(500)
        .json({ message: "Internal Server Error pada validasi gembok data." });
    }
  };
};

module.exports = checkLock;
