const { z } = require("zod");

const philosophySchema = z.object({
  philosophyTitle: z.string().optional(),
  status: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

const philosophyPillarSchema = z.object({
  iconId: z.string().optional(),
  title: z.string({ required_error: "Judul pilar wajib diisi." }).min(1, "Judul pilar tidak boleh kosong.").trim(),
  text: z.string().optional(),
  orderIndex: z.preprocess((val) => Number(val), z.number().optional()),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

module.exports = { philosophySchema, philosophyPillarSchema };
