const Inquiry = require("../models/Inquiry");
const InquirySubject = require("../models/InquirySubject");
const Settings = require("../models/Settings");
const { sendInquiryNotification } = require("../utils/mailer");

class InquiryService {
  // Process a new public inquiry submission and dispatch notification emails.
  async processInquirySubmission(payload) {
    const { name, email, phone, company, subject, message } = payload;

    // Validate active subject and fetch global settings
    const [activeSubject, companySettings] = await Promise.all([
      InquirySubject.findOne({ where: { name: subject, isActive: true } }),
      Settings.findOne(),
    ]);

    if (!activeSubject) {
      throw new Error("Invalid or inactive subject category.");
    }

    // Enforce strict redirection rules
    if (activeSubject.is_redirect) {
      throw new Error(`REDIRECT_REQUIRED:${activeSubject.redirect_url}`);
    }

    const logoUrl = companySettings?.companyLogo
      ? `${process.env.BASE_URL}/uploads/${companySettings.companyLogo}`
      : null;

    // Persist the inquiry to the database
    const newInquiry = await Inquiry.create({
      name,
      email,
      phone,
      company,
      subject,
      message,
    });

    // Dispatch email notification asynchronously (fire-and-forget)
    const targetEmail = activeSubject.recipient_email || process.env.SMTP_USER;

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

    return newInquiry;
  }

  // Retrieve all inquiries, ordered by newest first.
  async getAllInquiries() {
    return await Inquiry.findAll({ order: [["createdAt", "DESC"]] });
  }

  // Mark a specific inquiry as read.
  async markAsRead(id) {
    const inquiry = await Inquiry.findByPk(id);
    if (!inquiry) throw new Error("NOT_FOUND");

    await inquiry.update({ isRead: true });
    return inquiry;
  }

  // Permanently delete a specific inquiry.
  async deleteInquiry(id) {
    const inquiry = await Inquiry.findByPk(id);
    if (!inquiry) throw new Error("NOT_FOUND");

    await inquiry.destroy();
    return true;
  }

  // INQUIRY SUBJECT MANAGEMENT

  async getActiveSubjects() {
    return await InquirySubject.findAll({
      where: { isActive: true },
      order: [["id", "ASC"]],
    });
  }

  async getAllSubjects() {
    return await InquirySubject.findAll({ order: [["id", "ASC"]] });
  }

  async createSubject(payload) {
    return await InquirySubject.create(payload);
  }

  async updateSubject(id, payload) {
    const subject = await InquirySubject.findByPk(id);
    if (!subject) throw new Error("NOT_FOUND");

    await subject.update(payload);
    return subject;
  }

  async deleteSubject(id) {
    const subject = await InquirySubject.findByPk(id);
    if (!subject) throw new Error("NOT_FOUND");

    const usageCount = await Inquiry.count({
      where: { subject: subject.name },
    });

    if (usageCount > 0) {
      throw new Error(
        `Cannot delete. Subject is currently tied to ${usageCount} existing messages.`,
      );
    }

    await subject.destroy();
    return true;
  }
}

module.exports = new InquiryService();
