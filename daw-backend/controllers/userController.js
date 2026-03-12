const User = require("../models/User");

exports.getAllUsers = async (req, res) => {
  try {
    // Fetch all users w/o send it to frontend
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `Daw${randomNum}!`;

    const newUser = await User.create({
      name,
      email,
      role,
      password: tempPassword,
    });

    // Bisa panggil Nodemailer Function disini untuk mengirim 'tempPassword' ke email user
    console.log(`[INFO] Temp Password for ${email} is: ${tempPassword}`);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      // Jangan pernah kembalikan password asli di response production,
      // tapi untuk development kita kirim agar kamu bisa login nanti.
      tempPassword: tempPassword,
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
};

// Update User
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "Superadmin" && status === "Suspended") {
      return res.status(403).json({
        message: "You cannot suspend a Superadmin account via this panal.",
      });
    }
    await user.update({ name, email, role, status });
    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

// DELETE User
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "Superadmin") {
      return res.status(403).json({
        message: "Superadmin accounts cannot be deleted for safety reasons.",
      });
    }

    await user.destroy();
    res.json({ success: true, message: "User account deleted permanentely" });
  } catch (error) {
    res.status(500).json({ message: "Delete failed" });
  }
};
