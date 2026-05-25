const { z } = require("zod");

const newsSchema = z.object({
  title: z.string({ required_error: "Judul wajib diisi." }).min(3, "Judul minimal 3 karakter.").trim(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().optional(),
  category_id: z.preprocess((val) => (val && val !== "null" ? Number(val) : null), z.number().nullable().optional()),
  status: z.string().optional(),
  seo_title: z.string().optional(),
  meta_description: z.string().optional(),
  author: z.string().optional(),
  published_at: z.string().optional().nullable(),
  read_time: z.string().optional(),
  gallery_images: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

module.exports = { newsSchema };
