const { z } = require('zod');
const {
  POLICY_TYPES,
  POLICY_STATUS,
  RULE_TYPES,
  RULE_PRIORITIES,
  RULE_ACTION_TYPES,
  CONDITION_OPERATORS,
  LOGICAL_OPERATORS,
  RULE_EXECUTION_MODES,
} = require('../../constants');

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.any(),
  order: z.number().optional(),
});

const actionSchema = z.object({
  actionType: z.enum(RULE_ACTION_TYPES),
  params: z.record(z.any()).optional(),
  order: z.number().optional(),
});

const createPolicySchema = z.object({
  name: z.string().min(2).max(150),
  policyType: z.enum(POLICY_TYPES),
  description: z.string().max(1000).optional(),
  isDefault: z.boolean().optional(),
  config: z.record(z.any()).optional(),
  assignedDepartmentIds: z.array(objectId).optional(),
  assignedEmployeeProfileIds: z.array(objectId).optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
});

const updatePolicySchema = createPolicySchema.partial();

const createRuleSchema = z.object({
  name: z.string().min(2).max(150),
  ruleType: z.enum(RULE_TYPES),
  policyId: objectId.optional(),
  description: z.string().max(1000).optional(),
  priority: z.enum(RULE_PRIORITIES).optional(),
  executionMode: z.enum(RULE_EXECUTION_MODES).optional(),
  stopOnFailure: z.boolean().optional(),
  continueOnFailure: z.boolean().optional(),
  rootOperator: z.enum(LOGICAL_OPERATORS).optional(),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
});

const updateRuleSchema = createRuleSchema.partial();

const testRuleSchema = z.object({
  ruleType: z.enum(RULE_TYPES).optional(),
  ruleId: objectId.optional(),
  context: z.record(z.any()),
  employeeProfileId: objectId.optional(),
  userId: objectId.optional(),
});

const evaluateSchema = z.object({
  ruleType: z.enum(RULE_TYPES),
  context: z.record(z.any()),
  policyId: objectId.optional(),
  employeeProfileId: objectId.optional(),
  userId: objectId.optional(),
  dryRun: z.boolean().optional(),
});

const idParamSchema = z.object({ id: objectId });
const rollbackSchema = z.object({ version: z.coerce.number().int().min(1) });

const listQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  policyType: z.enum(POLICY_TYPES).optional(),
  ruleType: z.enum(RULE_TYPES).optional(),
  status: z.string().optional(),
  policyId: objectId.optional(),
  module: z.string().optional(),
});

module.exports = {
  createPolicySchema,
  updatePolicySchema,
  createRuleSchema,
  updateRuleSchema,
  testRuleSchema,
  evaluateSchema,
  idParamSchema,
  rollbackSchema,
  listQuerySchema,
};
