const { z } = require('zod');
const { WORKFLOW_TYPES, APPROVER_TYPES, APPROVAL_MODES, CONDITION_OPERATORS } = require('../../constants');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const createTemplateSchema = z.object({
  name: z.string().min(2).max(150),
  workflowType: z.enum(WORKFLOW_TYPES),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  config: z
    .object({
      approvalMode: z.enum(APPROVAL_MODES).optional(),
      reminderHours: z.array(z.number()).optional(),
      parallelApproval: z.boolean().optional(),
      sequentialApproval: z.boolean().optional(),
    })
    .optional(),
  levels: z
    .array(
      z.object({
        name: z.string().min(2).max(100),
        levelOrder: z.number().int().min(1),
        approverType: z.enum(APPROVER_TYPES),
        approverUserId: objectId.optional(),
        approverRoleId: objectId.optional(),
        approvalMode: z.enum(APPROVAL_MODES).optional(),
        isRequired: z.boolean().optional(),
        canSkip: z.boolean().optional(),
        escalationHours: z.number().min(0).optional(),
      })
    )
    .optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const createLevelSchema = z.object({
  name: z.string().min(2).max(100),
  levelOrder: z.number().int().min(1),
  approverType: z.enum(APPROVER_TYPES),
  approverUserId: objectId.optional(),
  approverRoleId: objectId.optional(),
  approvalMode: z.enum(APPROVAL_MODES).optional(),
  escalationHours: z.number().min(0).optional(),
});

const actionSchema = z.object({ comment: z.string().max(1000).optional() });
const delegateSchema = z.object({ delegateId: objectId, comment: z.string().max(500).optional() });
const instanceIdParam = z.object({ id: objectId });
const templateIdParam = z.object({ templateId: objectId });

const listQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  workflowType: z.enum(WORKFLOW_TYPES).optional(),
  status: z.string().optional(),
  entityType: z.string().optional(),
  approverId: objectId.optional(),
  requesterId: objectId.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  mine: z.coerce.boolean().optional(),
});

const createConditionSchema = z.object({
  name: z.string().min(2),
  field: z.string().min(1),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.any(),
  action: z.enum(['add_level', 'require_level', 'skip_level', 'switch_template']).optional(),
  targetLevelId: objectId.optional(),
  insertLevelId: objectId.optional(),
  priority: z.number().optional(),
});

const createDelegationSchema = z.object({
  delegatorId: objectId,
  delegateId: objectId,
  workflowType: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().max(500).optional(),
});

module.exports = {
  createTemplateSchema,
  updateTemplateSchema,
  createLevelSchema,
  actionSchema,
  delegateSchema,
  instanceIdParam,
  templateIdParam,
  listQuerySchema,
  createConditionSchema,
  createDelegationSchema,
};
