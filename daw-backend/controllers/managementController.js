const Management = require("../models/Management");
const { deleteSingleFile } = require("../utils/fileRemover");
const ErpApprovalService = require("../services/erpApprovalService");

// 1. GET ALL: Tampilkan semua data (Termasuk yang is_locked)
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
    res.status(500).json({ message: "Gagal mengambil data", error: error.message });
  }
};

// 2. POST: Create Management (Approval Aware)
exports.createManagement = async (req, res) => {
  try {
    const { name, role, description, level, order, status } = req.body;
    const photoUrl = req.file ? req.file.filename : null;

    const managementData = {
      name,
      role,
      description,
      level: level || "division",
      order: parseInt(order) || 1,
      photoUrl,
    };

    // --- JALUR EDITOR: REQUEST CREATE ---
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const tokenOWL = req.owl_token;
      
      const result = await ErpApprovalService.initiateApproval({
        model: Management,
        targetId: null, // Masih baru, belum ada ID asli
        action: "CREATE",
        payload: managementData,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({
        message: "Permintaan tambah anggota baru telah dikirim ke OWL.",
        ticket: result.notrans
      });
    }

    // --- JALUR SUPERADMIN: DIRECT CREATE ---
    const newPerson = await Management.create(managementData);
    res.status(201).json({ message: "Anggota baru berhasil ditambahkan!", data: newPerson });

  } catch (error) {
    console.error("CREATE Management Error:", error);
    res.status(500).json({ message: "Gagal menambah data", error: error.message });
  }
};

// 3. PUT: Update Management (Orchestrated)
exports.updateManagement = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, description, level, order, removePhoto, status } = req.body;

    const person = await Management.findByPk(id);
    if (!person) return res.status(404).json({ message: "Member not found" });

    // Cek jika data sedang dikunci (Safety check)
    if (person.is_locked && req.userRole?.toLowerCase() === "editor") {
      return res.status(423).json({ 
        message: "Data sedang dalam proses approval dan tidak dapat diubah.",
        ticket: person.lock_ticket
      });
    }

    let finalPhotoUrl = person.photoUrl;
    let oldPhotoToDelete = null;

    if (req.file) {
      oldPhotoToDelete = person.photoUrl;
      finalPhotoUrl = req.file.filename; 
    } else if (removePhoto === "true") {
      oldPhotoToDelete = person.photoUrl;
      finalPhotoUrl = null;
    }

    // --- JALUR EDITOR: REQUEST UPDATE ---
    if (req.userRole?.toLowerCase() === "editor" && status === "Published") {
      const packageContent = {
        name: name || person.name,
        role: role || person.role,
        description: description || person.description,
        level: level || person.level,
        order: parseInt(order) || person.order,
        photoUrl: finalPhotoUrl,
      };

      const tokenOWL = req.owl_token;
      const result = await ErpApprovalService.initiateApproval({
        model: Management,
        targetId: id,
        action: "UPDATE",
        payload: packageContent,
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({
        message: "Draf perubahan berhasil diajukan. Data asli telah dikunci.",
        ticket: result.notrans
      });
    }

    // --- JALUR SUPERADMIN: DIRECT UPDATE ---
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
    res.status(500).json({ message: "Gagal memperbarui data", error: error.message });
  }
};

// 4. DELETE: Management (Approval Aware)
exports.deleteManagement = async (req, res) => {
  try {
    const { id } = req.params;
    const person = await Management.findByPk(id);

    if (!person) return res.status(404).json({ message: "Data not found" });

    // --- JALUR EDITOR: REQUEST DELETE ---
    if (req.userRole?.toLowerCase() === "editor") {
      const tokenOWL = req.owl_token;
      
      const result = await ErpApprovalService.initiateApproval({
        model: Management,
        targetId: id,
        action: "DELETE",
        payload: { name: person.name, role: person.role }, // Payload minimal buat info
        userId: req.userId,
        owlUsername: req.owl_username,
        token: tokenOWL
      });

      return res.status(202).json({
        message: "Permintaan penghapusan dikirim. Data telah dikunci sampai disetujui Admin.",
        ticket: result.notrans
      });
    }

    // --- JALUR SUPERADMIN: DIRECT DELETE ---
    if (person.photoUrl) deleteSingleFile(person.photoUrl);
    await person.destroy();

    res.status(200).json({ message: "Data Management berhasil dihapus permanen." });

  } catch (error) {
    console.error("DELETE Management Error:", error);
    res.status(500).json({ message: "Gagal menghapus data", error: error.message });
  }
};