const { z } = require('zod');

const listQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  upcoming: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  companyId: z.string().optional(),
  companyCode: z.string().optional(),
});

module.exports = { listQuerySchema };
