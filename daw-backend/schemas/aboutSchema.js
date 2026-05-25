const { z } = require("zod");

const aboutSchema = z.object({
  spiritText: z.string().optional(),
  missionText: z.string().optional(),
  visionText: z.string().optional(),
  status: z.string().optional(),
  previous_notrans: z.string().nullable().optional(),
});

module.exports = { aboutSchema };
