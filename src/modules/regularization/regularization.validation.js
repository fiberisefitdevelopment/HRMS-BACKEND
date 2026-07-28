const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const raiseRegularizationSchema = z.object({
  date: z.coerce.date().optional(),
  reason: z.string().min(3).max(1000),
  requestedPunchIn: z.coerce.date().optional(),
  requestedPunchOut: z.coerce.date().optional(),
});

const regularizationIdParamSchema = z.object({
  id: objectId,
});

const eligibilityQuerySchema = z.object({
  date: z.coerce.date().optional(),
});

const listQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  employeeProfileId: objectId.optional(),
  scope: z.enum(['self', 'team']).optional(),
  all: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sort: z.string().optional(),
});

module.exports = {
  raiseRegularizationSchema,
  regularizationIdParamSchema,
  eligibilityQuerySchema,
  listQuerySchema,
};
