const { z } = require("zod");

const settingsSchema = z.object({
  status: z.string().optional(),
  previous_notrans: z.string().optional().nullable(),
}).passthrough(); // Allow all other dynamic textual fields to pass through safely

module.exports = { settingsSchema };
