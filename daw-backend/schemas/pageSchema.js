const { z } = require("zod");

const pageSchema = z.object({
  title: z.string({ required_error: "Judul halaman wajib diisi." }).min(1, "Judul tidak boleh kosong.").trim(),
  content: z.string().optional(),
  status: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

module.exports = { pageSchema };
