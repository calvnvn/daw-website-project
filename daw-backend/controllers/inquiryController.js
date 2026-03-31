const Inquiry = require("../models/Inquiry");
const InquirySubject = require("../models/InquirySubject");
const nodemailer = require("nodemailer");

// Email Configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

exports.submitInquiry = async (req, res) => {
  try {
    const { name, email, phone, company, subject, message } = req.body;

    const newInquiry = await Inquiry.create({
      name,
      email,
      phone,
      company,
      subject,
      message,
    });

    // Kirim Notifikasi Email (Berjalan di background)
    const mailOptions = {
      from: `"DAW Website" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER, // Kirim ke pribadi (dummy)
      replyTo: email,
      subject: `New Inquiry from ${name}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <br/>
        <p><strong>Message:</strong></p>
        <p style="padding:15px; background:#f5f5f5;">${message}</p>
      `,
    };

    transporter
      .sendMail(mailOptions)
      .catch((err) => console.log("Email error:", err.message));

    res.status(201).json({ success: true, data: newInquiry });
  } catch (error) {
    console.error("Submit Error:", error);
    res.status(500).json({ success: false, message: "Failed to submit" });
  }
};

exports.getAllInquiries = async (req, res) => {
  try {
    const inquiries = await Inquiry.findAll({ order: [["createdAt", "DESC"]] });
    res.json(inquiries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

// --- MASTER INQUIRY SUBJECT LOGIC ---
// 1. PUBLIC: Ambil subjek yang aktif saja (Untuk Form Contact Us)
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

// 2. ADMIN: Ambil semua subjek termasuk yang tidak aktif (Untuk Table Admin)
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await InquirySubject.findAll({ order: [["id", "ASC"]] });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. ADMIN: Tambah subjek baru
exports.createSubject = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const newSubject = await InquirySubject.create({ name, isActive });
    res.status(201).json(newSubject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. ADMIN: Update subjek
exports.updateSubject = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const subject = await InquirySubject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    await subject.update({ name, isActive });
    res.json({ success: true, data: subject });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await InquirySubject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ message: "Not found" });
    await subject.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
