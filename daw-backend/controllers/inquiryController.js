const inquiryService = require("../services/inquiryService");

// Public: Process contact form submission
exports.submitInquiry = async (req, res) => {
  try {
    const newInquiry = await inquiryService.processInquirySubmission(req.body);
    res.status(201).json({ success: true, data: newInquiry });
  } catch (error) {
    if (error.message.startsWith("REDIRECT_REQUIRED:")) {
      return res.status(403).json({
        success: false,
        message:
          "Subjek ini tidak menerima pesan. Silakan gunakan link yang disediakan.",
        redirect_url: error.message.split(":")[1],
      });
    }
    console.error("Submit Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin: Retrieve all incoming messages with pagination and filtering
exports.getAllInquiries = async (req, res) => {
  try {
    const { page, limit, search, subject } = req.query;
    const inquiries = await inquiryService.getAllInquiries({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      search,
      subject
    });
    res.json(inquiries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Toggle message read status
exports.markAsRead = async (req, res) => {
  try {
    await inquiryService.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error.message === "NOT_FOUND")
      return res.status(404).json({ message: "Not found" });
    res.status(500).json({ message: error.message });
  }
};

// Admin: Hard delete specific message
exports.deleteInquiry = async (req, res) => {
  try {
    await inquiryService.deleteInquiry(req.params.id);
    res.json({ success: true });
  } catch (error) {
    if (error.message === "NOT_FOUND")
      return res.status(404).json({ message: "Not found" });
    res.status(500).json({ message: error.message });
  }
};

// Admin: Bulk delete messages
exports.bulkDeleteInquiries = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: "Invalid payload, expected array of ids" });
    }
    await inquiryService.bulkDeleteInquiries(ids);
    res.json({ success: true, message: `Deleted ${ids.length} messages` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Reassign/Forward message to another department
exports.reassignInquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { newSubjectName } = req.body;
    if (!newSubjectName) {
      return res.status(400).json({ message: "newSubjectName is required" });
    }
    const updatedInquiry = await inquiryService.reassignInquiry(id, newSubjectName);
    res.json({ success: true, data: updatedInquiry });
  } catch (error) {
    if (error.message === "NOT_FOUND") {
      return res.status(404).json({ message: "Not found" });
    }
    res.status(400).json({ message: error.message });
  }
};

// MASTER INQUIRY SUBJECT LOGIC

// Public: Fetch active subjects for frontend dropdown
exports.getActiveSubjects = async (req, res) => {
  try {
    const subjects = await inquiryService.getActiveSubjects();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Fetch all subjects (Active & Inactive) for management table
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await inquiryService.getAllSubjects();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Register new inquiry category
exports.createSubject = async (req, res) => {
  try {
    const newSubject = await inquiryService.createSubject(req.body);
    res.status(201).json(newSubject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Modify existing subject routing/settings
exports.updateSubject = async (req, res) => {
  try {
    const subject = await inquiryService.updateSubject(req.params.id, req.body);
    res.json({ success: true, data: subject });
  } catch (error) {
    if (error.message === "NOT_FOUND")
      return res.status(404).json({ message: "Subject not found" });
    res.status(500).json({ message: error.message });
  }
};

// Admin: Prevent deletion of subjects currently tied to existing messages
exports.deleteSubject = async (req, res) => {
  try {
    await inquiryService.deleteSubject(req.params.id);
    res.json({ success: true, message: "Subject deleted successfully" });
  } catch (error) {
    if (error.message === "NOT_FOUND")
      return res.status(404).json({ message: "Subject not found" });
    res.status(400).json({ message: error.message });
  }
};
