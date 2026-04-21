// scripts/seedUsers.js
const sequelize = require("../config/database");
const Role = require("../models/Role");
const User = require("../models/User");

// 🚀 SUNTIKAN RELASI MANUAL (WAJIB ADA DI SINI)
// Karena script ini jalan di luar server.js, kita harus ingetin lagi ke Sequelize
Role.hasMany(User, { foreignKey: "roleId", as: "users" });
User.belongsTo(Role, { foreignKey: "roleId", as: "roleData" });

const seedDatabase = async () => {
  try {
    // 1. Alter: true memaksa Sequelize ngecek ulang kolom di MySQL
    // Kalau roleId belum ada, dia bakal otomatis bikinin kolomnya.
    await sequelize.sync({ alter: true });
    console.log("✅ Database tables synced and updated.");

    // Ambil Role superadmin
    const superadminRole = await Role.findOne({
      where: { name: "superadmin" },
    });

    if (!superadminRole) {
      console.log("❌ Role superadmin belum ada, jalanin seed roles dulu!");
      return;
    }

    const [user, created] = await User.findOrCreate({
      where: { owl_username: "bcs.dev" },
      defaults: {
        name: "superadmin Dev",
        email: "it@daw.co.id",
        roleId: superadminRole.id,
        status: "Active",
      },
    });

    if (!created) {
      user.roleId = superadminRole.id;
      await user.save();
      console.log("✅ User 'bcs.dev' updated with roleId.");
    } else {
      console.log("✅ User 'bcs.dev' created with roleId.");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedDatabase();
