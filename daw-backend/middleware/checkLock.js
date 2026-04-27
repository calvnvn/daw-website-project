// const {
//   Project,
//   Management,
//   AboutInfo,
//   History,
//   Page,
//   BusinessSection,
// } = require("../models");

const AboutInfo = require("../models/AboutInfo");
const BusinessSection = require("../models/BusinessSection");
const History = require("../models/History");
const Management = require("../models/Management");
const Page = require("../models/Page");
const Project = require("../models/Project");

/**
 * Middleware untuk mengecek status gembok (is_locked)
 * @param {Object} Model - Model Sequelize yang akan dicek (misal: Project)
 */
const checkLock = (Model) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const userRole = req.userRole; // Diambil dari middleware authJwt

      // IF  superadmin, langsung kasih jalan
      if (userRole === "superadmin") {
        return next();
      }

      // Cara data
      const record = await Model.findByPk(id);

      // Jika data tidak ketemu, controller handle 404
      if (!record) {
        return next();
      }

      // Cek apakah data sedang locked
      if (record.is_locked) {
        return res.status(423).json({
          message: "Data sedang dikunci (Locked).",
          error: `Perubahan ditolak karena data ini sedang dalam proses review (Tiket: ${record.lock_ticket || "N/A"}).`,
          lockTicket: record.lock_ticket,
        });
      }

      // Jika tidak locked, lanjut ke controller
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
