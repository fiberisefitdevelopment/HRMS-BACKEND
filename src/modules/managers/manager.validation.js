const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const assignManagerSchema = z.object({
  employeeProfileId: objectId,
  managerId: objectId,
});

const managerIdParamSchema = z.object({ managerId: objectId });

const teamAttendanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

module.exports = { assignManagerSchema, managerIdParamSchema, teamAttendanceQuerySchema };
