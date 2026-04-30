const Inquiry = require("../models/Inquiry");
const InquirySubject = require("../models/InquirySubject");
const { transporter } = require("../utils/mailer");
const Settings = require("../models/Settings");

exports.submitInquiry = async (req, res) => {
  try {
    const { name, email, phone, company, subject, message } = req.body;

    // Verifikasi Master Data Subject
    const [activeSubject, companySettings] = await Promise.all([
      InquirySubject.findOne({ where: { name: subject, isActive: true } }),
      Settings.findOne(), // Ambil baris pertama settings
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

    // Blokir jika Redirect
    if (activeSubject.is_redirect) {
      return res.status(403).json({
        success: false,
        message:
          "Subjek ini tidak menerima pesan. Silakan gunakan link yang disediakan.",
        redirect_url: activeSubject.redirect_url,
      });
    }

    // Simpan ke Database
    const newInquiry = await Inquiry.create({
      name,
      email,
      phone,
      company,
      subject,
      message,
    });

    // Smart Routing Logic. Menentukan kemana email akan dikirm
    const targetEmail = activeSubject.recipient_email || process.env.SMTP_USER;

    // Kirim Notifikasi Email (Berjalan di background)
    const mailOptions = {
      from: `"DAW Website Portal" <${process.env.SMTP_USER}>`,
      to: targetEmail,
      replyTo: email,
      subject: `[Inquiry] ${subject} - ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            /* Reset for Email */
            body { margin: 0; padding: 0; background-color: #F8F9FA; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          </style>
        </head>
        <body style="background-color: #F8F9FA; padding: 40px 20px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.04);">
                  
                  <tr>
                    <td align="center" style="background-color: #081C15; padding: 45px 30px; border-bottom: 4px solid #10b981;">
                      ${
                        logoUrl
                          ? `<img src="${logoUrl}" alt="DAW Logo" style="height: 60px; width: auto; margin-bottom: 15px; display: block;">`
                          : `<p style="margin: 0 0 10px 0; color: #10b981; font-weight: 700; font-size: 14px; letter-spacing: 2px;">PT DHARMA AGUNG WIJAYA</p>`
                      }
                      <h1 style="margin: 0; color: #ffffff; font-family: Georgia, serif; font-size: 24px; font-weight: normal; letter-spacing: 0.5px;">
                        New Contact Inquiry
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 40px 35px;">
                      <p style="margin: 0 0 25px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
                        Halo Tim <strong>${activeSubject.name}</strong>, Anda menerima pesan baru dari portal website.
                      </p>

                      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px; border: 1px solid #f1f5f9; border-radius: 12px; overflow: hidden;">
                        <tr>
                          <td style="padding: 15px; background-color: #f8fafc; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; width: 100px;">Name</td>
                          <td style="padding: 15px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 15px; font-weight: 500;">${name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 15px; background-color: #f8fafc; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Email</td>
                          <td style="padding: 15px; border-bottom: 1px solid #f1f5f9; color: #10b981; font-size: 15px; font-weight: 600;">${email}</td>
                        </tr>
                        <tr>
                          <td style="padding: 15px; background-color: #f8fafc; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Phone</td>
                          <td style="padding: 15px; color: #0f172a; font-size: 15px;">${phone}</td>
                        </tr>
                      </table>

                      <div style="background-color: #081C15; background: linear-gradient(to right, #081C15, #0a2d22); padding: 25px; border-radius: 12px; color: #ffffff;">
                        <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #10b981;">Message Content:</h3>
                        <p style="margin: 0; font-size: 16px; line-height: 1.7; white-space: pre-wrap;">${message}</p>
                      </div>

                      <div align="center" style="margin-top: 35px;">
                        <a href="mailto:${email}" style="background-color: #10b981; color: #ffffff; padding: 14px 35px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(16,185,129,0.3);">
                          Reply to Inquiry
                        </a>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                        Sent from official <strong>${companySettings?.companyName || "DAW Group"}</strong> Website Management System.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    transporter.sendMail(mailOptions).catch((err) => {
      console.error("[MAILER ERROR]:", err.message);
      // Note: Kita tidak throw error ke user jika email gagal terkirim (karena SMTP kadang delay),
      // selama data sudah tersimpan di database, proses dianggap sukses.
    });

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

// 4. ADMIN: Update subjek
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

exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await InquirySubject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ message: "Subject not found" });
    }

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
