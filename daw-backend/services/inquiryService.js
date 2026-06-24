const { Op } = require("sequelize");
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
      ? `${process.env.BACKEND_URL}/uploads/${companySettings.companyLogo}`
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

    // Strategi Central Archive Email: Selalu kirimkan salinan ke SMTP Utama
    const primaryEmail = process.env.SMTP_USER;
    const departmentEmail = activeSubject.recipient_email;

    let recipients = [primaryEmail];
    if (
      departmentEmail &&
      departmentEmail.trim() !== "" &&
      departmentEmail !== primaryEmail
    ) {
      recipients.push(departmentEmail);
    }
    const targetEmail = recipients.join(", ");

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

  // Retrieve inquiries with pagination, searching, and filtering
  async getAllInquiries({ page = 1, limit = 50, search = "", subject = "All" } = {}) {
    const offset = (page - 1) * limit;
    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { message: { [Op.like]: `%${search}%` } },
      ];
    }

    if (subject && subject !== "All") {
      whereClause.subject = subject;
    }

    const { rows, count } = await Inquiry.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    return {
      data: rows,
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / limit),
    };
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

  // Bulk delete inquiries for performance optimization
  async bulkDeleteInquiries(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("No IDs provided for bulk deletion");
    }
    
    await Inquiry.destroy({
      where: {
        id: { [Op.in]: ids }
      }
    });
    return true;
  }

  // Reassign an inquiry to a different subject/department
  async reassignInquiry(id, newSubjectName) {
    const inquiry = await Inquiry.findByPk(id);
    if (!inquiry) throw new Error("NOT_FOUND");

    const newSubject = await InquirySubject.findOne({
      where: { name: newSubjectName, isActive: true },
    });
    if (!newSubject) throw new Error("Invalid or inactive subject category.");
    if (newSubject.is_redirect) throw new Error("Cannot reassign to a redirect subject.");

    await inquiry.update({ subject: newSubject.name });

    // Send a new email to the new department
    const companySettings = await Settings.findOne();
    const logoUrl = companySettings?.companyLogo
      ? `${process.env.BACKEND_URL}/uploads/${companySettings.companyLogo}`
      : null;

    const primaryEmail = process.env.SMTP_USER;
    const departmentEmail = newSubject.recipient_email;

    let recipients = [primaryEmail];
    if (
      departmentEmail &&
      departmentEmail.trim() !== "" &&
      departmentEmail !== primaryEmail
    ) {
      recipients.push(departmentEmail);
    }
    const targetEmail = recipients.join(", ");

    sendInquiryNotification({
      targetEmail,
      name: inquiry.name,
      email: inquiry.email,
      phone: inquiry.phone,
      company: inquiry.company,
      subject: `[FORWARDED] ${inquiry.subject}`,
      message: `--- DITERUSKAN OLEH ADMIN UTAMA ---\n\n${inquiry.message}`,
      activeSubjectName: newSubject.name,
      logoUrl,
      companyName: companySettings?.companyName || "DAW Group",
    }).catch((err) => {
      console.error("[MAILER ERROR DURING REASSIGN]:", err.message);
    });

    return inquiry;
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
