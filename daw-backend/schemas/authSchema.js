const { z } = require("zod");

const loginSchema = z.object({
  uname: z.string({ required_error: "Username wajib diisi." }).min(1, "Username tidak boleh kosong.").trim(),
  password: z.string({ required_error: "Password wajib diisi." }).min(1, "Password tidak boleh kosong."),
});

module.exports = { loginSchema };
