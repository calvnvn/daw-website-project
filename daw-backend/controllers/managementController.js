const Management = require("../models/Management");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");

const JENIS_APP_CMS = process.env.CMS_APPROVAL_CODE;

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
    const photoUrl = req.file ? req.file.filename : null;

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
    const { name, role, description, level, order, removePhoto, status } =
      req.body;

    const person = await Management.findByPk(id);
    if (!person) return res.status(404).json({ message: "Member not found" });

    let finalPhotoUrl = person.photoUrl;
    let oldPhotoToDelete = null;

    if (req.file) {
      oldPhotoToDelete = person.photoUrl; // Tampung nama foto lama
      finalPhotoUrl = req.file.filename; // Ini akan bernama 'TEMP_...' jika uploader adalah Editor
    } else if (removePhoto === "true") {
      oldPhotoToDelete = person.photoUrl;
      finalPhotoUrl = null;
    }

    // Gatekeeper: Editor Flow
    if (
      req.userRole &&
      req.userRole.toLowerCase() === "editor" &&
      status === "Published"
    ) {
      const packageContent = {
        name: name || person.name,
        role: role || person.role,
        description: description || person.description,
        level: level || person.level,
        order: parseInt(order) || person.order,
        photoUrl: finalPhotoUrl,
        removePhotoStatus: removePhoto === "true", // Flag tambahan untuk Admin tahu
      };

      const tokenOWL = req.headers["authorization"]?.split(" ")[1];
      const result = await ErpApprovalService.initiateApproval({
        model: Management,      // Mengoper Model secara dinamis
        targetId: id,           // PK data asli
        payload: packageContent,// Data revisi
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({
        message: "Perubahan sedang ditinjau. Data asli telah dikunci.",
        ticket: result.notrans
      });
    }

    console.log(">>> JALUR SUPERADMIN: DIRECT EXECUTION <<<");
    // Superadmin Flow (Langsung eksekusi)
    // Hapus file lama HANYA jika yang update adalah Admin
    if (req.userRole.toLowerCase() !== "editor" && oldPhotoToDelete) {
      deleteSingleFile(oldPhotoToDelete);
    }

    await person.update({
      name: name || person.name,
      role: role || person.role,
      description: description || person.description,
      level: level || person.level,
      order: parseInt(order) || person.order,
      photoUrl: finalPhotoUrl,
      is_locked: false, 
      lock_ticket: null
    });

    res.status(200).json({ message: "Data Management berhasil diperbarui langsung!" });
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
    deleteSingleFile(person.photoUrl);
    // Hapus dari DB
    await person.destroy();

    res.status(200).json({ message: "Member and photo deleted permanently." });
  } catch (error) {
    console.error("DELETE Management Error:", error);
    res.status(500).json({ message: "Failed to delete", error: error.message });
  }
};
