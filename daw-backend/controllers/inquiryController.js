const Inquiry = require("../models/Inquiry");
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
  tls: { rejectUnauthorized: false }, // Penting untuk jaringan kantor
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
