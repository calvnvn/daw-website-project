const { z } = require("zod");

const createUserSchema = z.object({
  email: z.string().email("Format email tidak valid.").or(z.literal("")).optional().nullable(),
  roleId: z.string({ required_error: "Role wajib dipilih." }).uuid("ID Role tidak valid."),
  owl_username: z.string({ required_error: "OWL Username wajib diisi." }).min(1, "OWL Username tidak boleh kosong.").trim(),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong.").trim().optional(),
  email: z.string().email("Format email tidak valid.").or(z.literal("")).optional().nullable(),
  roleId: z.string().uuid("ID Role tidak valid.").optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

module.exports = { createUserSchema, updateUserSchema };
