const { z } = require("zod");

const createAchievementSchema = z.object({
  title: z
    .string({ required_error: "Judul prestasi wajib diisi." })
    .min(3, "Judul minimal harus 3 karakter.")
    .max(100, "Judul maksimal 100 karakter.")
    .trim(),

  year: z.preprocess(
    (val) => Number(val),
    z
      .number({ required_error: "Tahun wajib diisi." })
      .int()
      .min(1900, "Tahun minimal 1900.")
      .max(2100, "Tahun maksimal 2100.")
  ),

  description: z
    .string({ required_error: "Deskripsi wajib diisi." })
    .min(10, "Deskripsi minimal harus 10 karakter.")
    .trim(),

  category: z.string().optional(),
  iconId: z.string().optional(),
  date: z.string().optional(),
  status: z.string().optional(),
  news_article_id: z.preprocess(
    (val) => (val === "null" || val === "" || val === undefined ? null : val),
    z.string().uuid("ID Artikel Berita tidak valid.").nullable().optional()
  ),
});

const updateAchievementSchema = createAchievementSchema.extend({
  removePhoto: z
    .union([z.boolean(), z.string()])
    .transform((val) => val === "true" || val === true)
    .optional(),
  previous_notrans: z.string().nullable().optional(),
}).partial();

module.exports = { createAchievementSchema, updateAchievementSchema };
