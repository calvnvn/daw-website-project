const Management = require("../models/Management");
const fs = require("fs");
const path = require("path");

/**
 * 🚀 HELPER: Menghapus file secara aman dari storage
 * Menangani leading slash dan path absolut
 */
const deletePhysicalFile = (relativeUrl) => {
  if (!relativeUrl) return;

  // Hilangkan leading slash jika ada agar path.join bekerja benar
  // '/uploads/foto.jpg' -> 'uploads/foto.jpg'
  const cleanPath = relativeUrl.startsWith("/")
    ? relativeUrl.substring(1)
    : relativeUrl;

  // Gunakan process.cwd() agar path selalu relatif terhadap root project
  const fullPath = path.join(process.cwd(), "public", cleanPath);

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`[CLEANUP] Deleted: ${fullPath}`);
    }
  } catch (err) {
    console.error(
      `[CLEANUP ERROR] Failed to delete ${relativeUrl}:`,
      err.message,
    );
  }
};

// 1. GET Data
exports.getAllManagements = async (req, res) => {
  try {
    const managements = await Management.findAll({
      order: [
        ["level", "ASC"],
        ["order", "ASC"],
      ],
    });
    res.status(200).json(managements);
  } catch (error) {
    console.error("GET Management Error:", error);
    res.status(500).json({ message: "Retrieve failed", error: error.message });
  }
};

// 2. POST Data
exports.createManagement = async (req, res) => {
  try {
    const { name, role, description, level, order } = req.body;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const newPerson = await Management.create({
      name,
      role,
      description,
      level: level || "division",
      order: order || 1,
      photoUrl,
    });

    res
      .status(201)
      .json({ message: "Member added successfully!", data: newPerson });
  } catch (error) {
    console.error("CREATE Management Error:", error);
    res
      .status(500)
      .json({ message: "Failed to add data", error: error.message });
  }
};

// 3. PUT: Edit Management
exports.updateManagement = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, description, level, order, removePhoto } = req.body;

    const person = await Management.findByPk(id);
    if (!person) return res.status(404).json({ message: "Member not found" });

    let finalPhotoUrl = person.photoUrl;

    // Skenario 1: Ada Upload File Baru
    if (req.file) {
      deletePhysicalFile(person.photoUrl); // Hapus foto lama
      finalPhotoUrl = `/uploads/${req.file.filename}`;
    }
    // Skenario 2: User klik 'Remove Photo' di UI
    else if (removePhoto === "true") {
      deletePhysicalFile(person.photoUrl);
      finalPhotoUrl = null;
    }

    await person.update({
      name,
      role,
      description,
      level,
      order: parseInt(order) || person.order,
      photoUrl: finalPhotoUrl,
    });

    res.status(200).json({ message: "Updated successfully!", data: person });
  } catch (error) {
    console.error("UPDATE Management Error:", error);
    res.status(500).json({ message: "Failed to update", error: error.message });
  }
};

// 4. DELETE: Hapus
exports.deleteManagement = async (req, res) => {
  try {
    const { id } = req.params;
    const person = await Management.findByPk(id);

    if (!person) return res.status(404).json({ message: "Data not found" });

    // Hapus file fisik
    deletePhysicalFile(person.photoUrl);

    // Hapus dari DB
    await person.destroy();

    res.status(200).json({ message: "Member and photo deleted permanently." });
  } catch (error) {
    console.error("DELETE Management Error:", error);
    res.status(500).json({ message: "Failed to delete", error: error.message });
  }
};
