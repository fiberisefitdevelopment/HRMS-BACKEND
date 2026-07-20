const { z } = require('zod');

const leaveTypeConfigSchema = z.object({
  code: z.string().min(2).max(10).toUpperCase(),
  name: z.string().min(2).max(100),
  leaveType: z.string().min(2).max(50),
  creditAmount: z.number().min(0).optional(),
  creditCycle: z.enum(['monthly', 'quarterly', 'half_yearly', 'yearly']).optional(),
  maxBalance: z.number().min(0).optional(),
  carryForward: z.boolean().optional(),
  carryForwardLimit: z.number().min(0).optional(),
  requiresAttachment: z.boolean().optional(),
  allowNegativeBalance: z.boolean().optional(),
  expiryMonths: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  approvalFlow: z.array(z.enum(['manager', 'hr'])).optional(),
});

const updatePolicySchema = z.object({
  name: z.string().min(2).max(150).optional(),
  leaveTypes: z.array(leaveTypeConfigSchema).optional(),
  shortLeave: z
    .object({
      monthlyAllowance: z.number().min(0).optional(),
      autoDeduct: z.boolean().optional(),
      resetMonthly: z.boolean().optional(),
    })
    .optional(),
  approvalWorkflow: z
    .object({
      stages: z.array(z.enum(['manager', 'hr'])).optional(),
      hrFinalApproval: z.boolean().optional(),
    })
    .optional(),
  workingDaysForLeave: z
    .object({
      excludeWeekends: z.boolean().optional(),
      workingDays: z.array(z.number().int().min(0).max(6)).optional(),
    })
    .optional(),
  holidays: z.array(z.object({ date: z.coerce.date(), name: z.string() })).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

module.exports = { updatePolicySchema };
