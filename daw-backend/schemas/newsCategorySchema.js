const { z } = require("zod");

const newsCategorySchema = z.object({
  name: z.string({ required_error: "Nama kategori wajib diisi." }).min(1, "Nama tidak boleh kosong.").trim(),
  color: z.string().optional(),
  orderIndex: z.preprocess((val) => Number(val), z.number().optional()),
}).passthrough();

module.exports = { newsCategorySchema };
