const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const leaveFieldsSchema = z.object({
  leaveType: z.string().min(2).max(50),
  leaveTypeCode: z.string().min(2).max(10).optional(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  totalDays: z.number().min(0.5).optional(),
  isHalfDay: z.boolean().optional(),
  halfDaySession: z.enum(['morning', 'afternoon']).optional(),
  reason: z.string().min(3).max(1000),
  attachments: z.array(z.string()).optional(),
  /** Medical leave prescription URL (also set automatically when uploading prescription file) */
  prescription: z.string().optional(),
});

const applyLeaveSchema = leaveFieldsSchema
  .extend({
    /** Target employee for HR manual leave entry */
    employeeProfileId: objectId.optional(),
    userId: objectId.optional(),
  })
  .refine((d) => !(d.employeeProfileId && d.userId), {
    message: 'Provide either employeeProfileId or userId, not both',
    path: ['employeeProfileId'],
  })
  .refine(
    (d) => {
      const hasStart = d.startDate != null;
      const hasEnd = d.endDate != null;
      if (hasStart !== hasEnd) return false;
      if (!hasStart && (d.totalDays == null || d.totalDays < 0.5)) return false;
      return true;
    },
    {
      message:
        'Provide both startDate and endDate, or omit both and send totalDays. Partial date range is not allowed.',
      path: ['totalDays'],
    }
  );

const bulkLeaveSchema = leaveFieldsSchema
  .extend({
    employeeProfileIds: z.array(objectId).min(1).max(200),
  })
  .refine(
    (d) => {
      const hasStart = d.startDate != null;
      const hasEnd = d.endDate != null;
      if (hasStart !== hasEnd) return false;
      if (!hasStart && (d.totalDays == null || d.totalDays < 0.5)) return false;
      return true;
    },
    {
      message:
        'Provide both startDate and endDate, or omit both and send totalDays. Partial date range is not allowed.',
      path: ['totalDays'],
    }
  );

/** HR credits leave balance (adds days) — not a leave request */
const creditBalanceSchema = z.object({
  employeeProfileId: objectId,
  leaveType: z.string().min(2).max(50),
  leaveTypeCode: z.string().min(2).max(10).optional(),
  totalDays: z.number().min(0.5),
  reason: z.string().min(3).max(1000),
});

const bulkCreditBalanceSchema = z.object({
  employeeProfileIds: z.array(objectId).min(1).max(200),
  leaveType: z.string().min(2).max(50),
  leaveTypeCode: z.string().min(2).max(10).optional(),
  totalDays: z.number().min(0.5),
  reason: z.string().min(3).max(1000),
});

const approveRejectSchema = z.object({
  comment: z.string().max(500).optional(),
});

const cancelLeaveSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

const leaveIdParamSchema = z.object({ id: objectId });

const leaveScopeSchema = z.enum(['self', 'team']);

const listQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  leaveTypeCode: z.string().optional(),
  departmentId: objectId.optional(),
  employeeProfileId: objectId.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  all: z.coerce.boolean().optional(),
  scope: leaveScopeSchema.optional(),
});

const calendarQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  scope: leaveScopeSchema.optional(),
});

const reportQuerySchema = z.object({
  year: z.coerce.number().optional(),
  month: z.coerce.number().optional(),
  quarter: z.coerce.number().optional(),
  departmentId: objectId.optional(),
  leaveTypeCode: z.string().optional(),
  status: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  format: z.enum(['xlsx', 'csv']).optional(),
});

module.exports = {
  applyLeaveSchema,
  bulkLeaveSchema,
  creditBalanceSchema,
  bulkCreditBalanceSchema,
  approveRejectSchema,
  cancelLeaveSchema,
  leaveIdParamSchema,
  listQuerySchema,
  calendarQuerySchema,
  reportQuerySchema,
};
