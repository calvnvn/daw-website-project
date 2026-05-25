const { z } = require("zod");

const projectSchema = z.object({
  title: z.string({ required_error: "Judul proyek wajib diisi." }).min(3, "Judul minimal 3 karakter.").trim(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  category: z.string({ required_error: "Kategori wajib diisi." }).min(1, "Kategori tidak boleh kosong.").trim(),
  status: z.string().optional(),
  seo_title: z.string().optional(),
  meta_description: z.string().optional(),
  author: z.string().optional(),
  existing_gallery: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

module.exports = { projectSchema };
