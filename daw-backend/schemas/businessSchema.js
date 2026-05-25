const { z } = require("zod");

const businessSchema = z.object({
  title: z.string({ required_error: "Judul wajib diisi." }).min(1, "Judul tidak boleh kosong.").trim(),
  category: z.string().optional(),
  htmlContent: z.string().optional(),
  hasMap: z.union([z.boolean(), z.string()]).transform((val) => val === "true" || val === true).optional(),
  mapMarkers: z.string().optional(),
  status: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

module.exports = { businessSchema };
