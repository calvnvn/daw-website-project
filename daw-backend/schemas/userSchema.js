const { z } = require("zod");

const createUserSchema = z.object({
  email: z.string().email("Format email tidak valid.").optional().nullable(),
  roleId: z.preprocess((val) => Number(val), z.number().int({ required_error: "Role ID wajib diisi." })),
  owl_username: z.string({ required_error: "OWL Username wajib diisi." }).min(1, "OWL Username tidak boleh kosong.").trim(),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong.").trim().optional(),
  email: z.string().email("Format email tidak valid.").optional().nullable(),
  roleId: z.preprocess((val) => Number(val), z.number().int()).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

module.exports = { createUserSchema, updateUserSchema };
