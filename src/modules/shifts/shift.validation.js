const { z } = require('zod');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const createShiftSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  startTime: z.string(),
  endTime: z.string(),
  workingDays: z.array(z.number().int().min(0).max(6)).optional(),
  breakTimings: z
    .array(
      z.object({
        type: z.enum(['lunch', 'tea_break_1', 'tea_break_2']),
        start: z.string().optional(),
        end: z.string().optional(),
        durationMinutes: z.number().optional(),
      })
    )
    .optional(),
  gracePeriodMinutes: z.number().optional(),
  policyId: objectId.optional(),
});

const updateShiftSchema = createShiftSchema.partial();

const assignShiftSchema = z.object({
  employeeProfileId: objectId,
  userId: objectId,
  shiftId: objectId,
});

const shiftIdParamSchema = z.object({ id: objectId });

module.exports = { createShiftSchema, updateShiftSchema, assignShiftSchema, shiftIdParamSchema };
