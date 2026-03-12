const User = require("./models/User");
const sequelize = require("./config/database");

const createSuperadmin = async () => {
  try {
    console.log("⏳ Menyiapkan pembuatan akun Superadmin...");

    // 1. Cek apakah email ini sudah ada di database
    const adminEmail = "jf.calvin20@gmail.com";
    const existingUser = await User.findOne({ where: { email: adminEmail } });

    if (existingUser) {
      console.log(
        `An account with email ${adminEmail} already exists in the database.!`,
      );
      process.exit();
    }

    // 2. Buat akun Superadmin (Password akan otomatis di-enkripsi oleh Model)
    await User.create({
      name: "Jap Calvin",
      email: adminEmail,
      password: "AdminDaw123!", // <-- Ganti dengan password yang kamu mau
      role: "Superadmin",
      status: "Active",
    });

    console.log(
      "✅ BOOM! Akun Superadmin 'Jap Calvin' berhasil disuntikkan ke Database!",
    );
    console.log("📧 Email:", adminEmail);
    console.log("🔑 Password: AdminDaw123! (Sudah di-hash di DB)");

    process.exit();
  } catch (error) {
    console.error("❌ Gagal membuat Superadmin:", error);
    process.exit(1);
  }
};

createSuperadmin();
