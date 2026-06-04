const { z } = require("zod");

const heroSchema = z.object({
  title: z.string({ required_error: "Judul hero wajib diisi." }).min(1, "Judul tidak boleh kosong.").trim(),
  subtitle: z.string().optional().nullable(),
  order: z.preprocess((val) => Number(val), z.number().optional()),
  status: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

const statSchema = z.object({
  icon: z.string().optional().nullable(),
  value: z.string({ required_error: "Nilai wajib diisi." }).min(1, "Nilai tidak boleh kosong."),
  label: z.string({ required_error: "Label wajib diisi." }).min(1, "Label tidak boleh kosong."),
  desc: z.string().optional().nullable(),
  order: z.preprocess((val) => Number(val), z.number().optional()),
  status: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough();

module.exports = { heroSchema, statSchema };

