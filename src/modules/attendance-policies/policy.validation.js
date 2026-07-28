const { z } = require('zod');

const objectIdString = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, 'Invalid employee profile id');

const geofencingSchema = z
  .object({
    enabled: z.boolean().optional(),
    enforceOnPunchIn: z.boolean().optional(),
    enforceOnPunchOut: z.boolean().optional(),
    applyToAllEmployees: z.boolean().optional(),
    employeeProfileIds: z.array(objectIdString).optional(),
  })
  .optional();

const updatePolicySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    officeTimings: z
      .object({
        defaultStart: z.string().optional(),
        defaultEnd: z.string().optional(),
      })
      .optional(),
    workingDays: z.array(z.number().int().min(0).max(6)).optional(),
    gracePeriodMinutes: z.number().int().min(0).optional(),
    regularization: z.record(z.any()).optional(),
    dailyWageBuffer: z.record(z.any()).optional(),
    workingHours: z.record(z.any()).optional(),
    breaks: z.record(z.any()).optional(),
    latePolicy: z.record(z.any()).optional(),
    missingPunchRules: z.record(z.any()).optional(),
    autoPunchOut: z.record(z.any()).optional(),
    futureSettings: z.record(z.any()).optional(),
    geofencing: geofencingSchema,
    status: z.enum(['active', 'inactive']).optional(),
  })
  .passthrough();

module.exports = { updatePolicySchema, geofencingSchema };
