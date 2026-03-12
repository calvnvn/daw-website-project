const Management = require("../models/Management");
const fs = require("fs");
const path = require("path");

// 1. GET Data based on Order
exports.getAllManagements = async (req, res) => {
  try {
    const managements = await Management.findAll({
      order: [
        ["level", "ASC"], // Ini opsional, tapi order (1, 2, 3) yang paling penting
        ["order", "ASC"],
      ],
    });
    res.status(200).json(managements);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve management data",
      error: error.message,
    });
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
      .json({ message: "Successfully added members!", data: newPerson });
  } catch (error) {
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
    if (!person) return res.status(404).json({ message: "Data not found" });

    let photoUrl = person.photoUrl;

    // 2. LOGIKA PENENTUAN PHOTO URL
    if (req.file) {
      if (person.photoUrl) {
        const oldPhotoPath = path.join(
          __dirname,
          "..",
          "public",
          person.photoUrl,
        );
        try {
          if (fs.existsSync(oldPhotoPath)) fs.unlinkSync(oldPhotoPath);
        } catch (err) {
          console.error("[FILE ERROR] Gagal hapus foto lama:", err.message);
        }
      }
      photoUrl = `/uploads/${req.file.filename}`;
    } else if (removePhoto === "true" && person.photoUrl) {
      // Skenario: Hapus foto tanpa upload baru
      const oldPhotoPath = path.join(
        __dirname,
        "..",
        "public",
        person.photoUrl,
      );
      try {
        if (fs.existsSync(oldPhotoPath)) fs.unlinkSync(oldPhotoPath);
      } catch (err) {
        console.error("[FILE ERROR] Gagal hapus foto:", err.message);
      }
      photoUrl = null;
    }

    // 3. UPDATE DI LUAR BLOK IF (Agar teks tetap ter-update meskipun foto tidak berubah)
    await person.update({
      name,
      role,
      description,
      level,
      order,
      photoUrl,
    });

    res.status(200).json({
      message: "Data updated successfully!",
      data: person,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update data",
      error: error.message,
    });
  }
};

// 4. DELETE: Hapus Anggota
exports.deleteManagement = async (req, res) => {
  try {
    const { id } = req.params;
    const person = await Management.findByPk(id);

    if (!person)
      return res.status(404).json({ message: "Data tidak ditemukan" });

    if (person.photoUrl) {
      const photoPath = path.join(__dirname, "..", "public", person.photoUrl);
      try {
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
          console.log(
            `[FILE DELETED] Photos are deleted along with the data: ${photoPath}`,
          );
        }
      } catch (err) {
        console.error(
          "[FILE ERROR] Failed to delete photo while deleting:",
          err.message,
        );
      }
    }

    await person.destroy();
    res
      .status(200)
      .json({ message: "Data and photos have been successfully deleted!" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete data", error: error.message });
  }
};
