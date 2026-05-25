const { z } = require("zod");

const markerItemSchema = z.object({
  title: z.string().min(1, "Judul marker tidak boleh kosong.").trim(),
  desc: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  dotX: z.union([z.number(), z.string()]).transform((val) => String(val)),
  dotY: z.union([z.number(), z.string()]).transform((val) => String(val)),
  boxX: z.union([z.number(), z.string()]).transform((val) => String(val)),
  boxY: z.union([z.number(), z.string()]).transform((val) => String(val)),
  mapUrl: z.string().optional().nullable(),
}).passthrough();

const businessSchema = z.object({
  title: z.string({ required_error: "Judul wajib diisi." }).min(1, "Judul tidak boleh kosong.").trim(),
  category: z.string().optional(),
  htmlContent: z.string().optional(),
  hasMap: z.union([z.boolean(), z.string()]).transform((val) => val === "true" || val === true).optional(),
  mapMarkers: z.preprocess(
    (val) => {
      if (typeof val === "string" && val.trim() !== "") {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return val;
    },
    z.array(markerItemSchema).optional()
  ),
  status: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

module.exports = { businessSchema };
