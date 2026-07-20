const { z } = require('zod');

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().max(100).optional(),
});

module.exports = { listQuerySchema };
