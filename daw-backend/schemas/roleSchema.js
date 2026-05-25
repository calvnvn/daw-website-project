const { z } = require("zod");

const roleSchema = z.object({
  name: z.string({ required_error: "Nama Role wajib diisi." }).min(1, "Nama Role tidak boleh kosong.").trim(),
  description: z.string().optional(),
});

module.exports = { roleSchema };
