const { z } = require("zod");

const createInquirySchema = z.object({
  name: z.string({ required_error: "Nama wajib diisi." }).min(1, "Nama tidak boleh kosong.").trim(),
  email: z.string({ required_error: "Email wajib diisi." }).email("Format email tidak valid.").trim(),
  phone: z.string().optional(),
  company: z.string().optional(),
  subject: z.string({ required_error: "Subjek wajib dipilih." }).min(1, "Subjek tidak boleh kosong."),
  message: z.string({ required_error: "Pesan wajib diisi." }).min(10, "Pesan minimal 10 karakter.").trim(),
});

module.exports = { createInquirySchema };
