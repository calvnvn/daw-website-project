const Inquiry = require("../models/Inquiry");
const InquirySubject = require("../models/InquirySubject");
const { transporter, sendInquiryNotification } = require("../utils/mailer");
const Settings = require("../models/Settings");

// Public: Process contact form submission and dispatch email
exports.submitInquiry = async (req, res) => {
  try {
    const { name, email, phone, company, subject, message } = req.body;

    // Validate active subject and fetch global settings
    const [activeSubject, companySettings] = await Promise.all([
      InquirySubject.findOne({ where: { name: subject, isActive: true } }),
      Settings.findOne(),
    ]);

    if (!activeSubject) {
      return res.status(400).json({
        success: false,
        message: "Kategori subjek tidak valid atau sedang tidak aktif.",
      });
    }

    const logoUrl = companySettings?.companyLogo
      ? `${process.env.BASE_URL}/uploads/${companySettings.companyLogo}`
      : null;

    // Reject submission if subject is strictly for external redirection
    if (activeSubject.is_redirect) {
      return res.status(403).json({
        success: false,
        message:
          "Subjek ini tidak menerima pesan. Silakan gunakan link yang disediakan.",
        redirect_url: activeSubject.redirect_url,
      });
    }

    // Persist message to database
    const newInquiry = await Inquiry.create({
      name,
      email,
      phone,
      company,
      subject,
      message,
    });

    // Smart Routing: Determine target email based on subject configuration
    const targetEmail = activeSubject.recipient_email || process.env.SMTP_USER;

    // Send email using consolidated mailer helper
    sendInquiryNotification({
      targetEmail,
      name,
      email,
      phone,
      company,
      subject,
      message,
      activeSubjectName: activeSubject.name,
      logoUrl,
      companyName: companySettings?.companyName || "DAW Group",
    }).catch((err) => {
      console.error("[MAILER ERROR]:", err.message);
    });

    res.status(201).json({ success: true, data: newInquiry });
  } catch (error) {
    console.error("Submit Error:", error);
    res.status(500).json({ success: false, message: "Failed to submit" });
  }
};

// Admin: Retrieve all incoming messages
exports.getAllInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.findAll({ order: [["createdAt", "DESC"]] });
    res.json(inquiries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Toggle message read status
exports.markAsRead = async (req, res) => {
  try {
    const inquiry = await Inquiry.findByPk(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Not found" });
    await inquiry.update({ isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Hard delete specific message
exports.deleteInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findByPk(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Not found" });
    await inquiry.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= MASTER INQUIRY SUBJECT LOGIC =================

// Public: Fetch active subjects for frontend dropdown
exports.getActiveSubjects = async (req, res) => {
  try {
    const subjects = await InquirySubject.findAll({
      where: { isActive: true },
      order: [["id", "ASC"]],
    });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Fetch all subjects (Active & Inactive) for management table
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await InquirySubject.findAll({ order: [["id", "ASC"]] });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Register new inquiry category
exports.createSubject = async (req, res) => {
  try {
    const { name, isActive, recipient_email, is_redirect, redirect_url } =
      req.body;
    const newSubject = await InquirySubject.create({
      name,
      isActive,
      recipient_email,
      is_redirect,
      redirect_url,
    });
    res.status(201).json(newSubject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Modify existing subject routing/settings
exports.updateSubject = async (req, res) => {
  try {
    const { name, isActive, recipient_email, is_redirect, redirect_url } =
      req.body;
    const subject = await InquirySubject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    await subject.update({
      name,
      isActive,
      recipient_email,
      is_redirect,
      redirect_url,
    });
    res.json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Prevent deletion of subjects currently tied to existing messages
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await InquirySubject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    // Referential integrity check
    const usageCount = await Inquiry.count({
      where: { subject: subject.name },
    });

    if (usageCount > 0) {
      return res.status(400).json({
        message: `Tidak dapat menghapus. Subjek ini sedang digunakan oleh ${usageCount} pesan masuk. Nonaktifkan saja (set Inactive) jika tidak ingin digunakan lagi.`,
      });
    }
    await subject.destroy();
    res.json({ success: true, message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
