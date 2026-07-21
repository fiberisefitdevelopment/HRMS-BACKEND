const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');
const breakTypeSchema = z.enum(['lunch', 'tea_break_1', 'tea_break_2']);

const punchSchema = z.object({
  source: z.enum(['web', 'mobile', 'manual', 'api', 'biometric', 'qr']).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  accuracyMeters: z.coerce.number().min(0).optional(),
});

const locationHeartbeatSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  accuracyMeters: z.coerce.number().min(0).optional(),
});

const breakSchema = z.object({
  breakType: breakTypeSchema,
});

const correctAttendanceSchema = z.object({
  punchIn: z.object({ timestamp: z.coerce.date() }).optional(),
  punchOut: z.object({ timestamp: z.coerce.date() }).optional(),
  attendanceStatus: z.string().optional(),
  remarks: z.string().max(500).optional(),
});

const reportQuerySchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'department', 'shift', 'late', 'regularization']).optional(),
  date: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  departmentId: objectId.optional(),
  shiftId: objectId.optional(),
  status: z.string().optional(),
  userId: objectId.optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const monthlySummarySchema = z.object({
  year: z.coerce.number().int().min(2000),
  month: z.coerce.number().int().min(1).max(12),
});

const musterRollQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  departmentId: objectId.optional(),
  status: z.enum(['active', 'inactive', 'terminated', 'on_leave', 'resigned']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const listQuerySchema = z.object({
  employeeId: z.string().trim().min(1).max(20).optional(),
  employeeProfileId: objectId.optional(),
  userId: objectId.optional(),
  shiftId: objectId.optional(),
  status: z.string().optional(),
  scope: z.enum(['self', 'team']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().optional(),
});

module.exports = {
  punchSchema,
  locationHeartbeatSchema,
  breakSchema,
  correctAttendanceSchema,
  reportQuerySchema,
  monthlySummarySchema,
  musterRollQuerySchema,
  listQuerySchema,
  attendanceIdParamSchema: z.object({ id: objectId }),
};
