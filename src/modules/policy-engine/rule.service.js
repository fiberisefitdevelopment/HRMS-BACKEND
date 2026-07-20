const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { RULE_PRIORITY_ORDER } = require('../../constants');
const ruleRepository = require('./rule.repository');
const RuleGroup = require('./ruleGroup.model');
const RuleCondition = require('./ruleCondition.model');
const RuleAction = require('./ruleAction.model');

const formatRule = (r) => ({
  id: r._id,
  companyId: r.companyId,
  policyId: r.policyId,
  name: r.name,
  ruleType: r.ruleType,
  description: r.description,
  version: r.version,
  status: r.status,
  priority: r.priority,
  priorityOrder: r.priorityOrder,
  isEnabled: r.isEnabled,
  executionMode: r.executionMode,
  stopOnFailure: r.stopOnFailure,
  rootGroupId: r.rootGroupId,
  publishedAt: r.publishedAt,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const createRule = async (data, companyId, actorId, req) => {
  const priorityOrder = RULE_PRIORITY_ORDER[data.priority || 'medium'] || 2;

  const rule = await ruleRepository.create({
    ...data,
    companyId,
    priorityOrder,
    createdBy: actorId,
    updatedBy: actorId,
  });

  const rootGroup = await RuleGroup.create({
    companyId,
    ruleId: rule._id,
    logicalOperator: data.rootOperator || 'and',
    isRoot: true,
    order: 0,
  });

  await ruleRepository.updateById(rule._id, { rootGroupId: rootGroup._id }, { companyId });

  if (data.conditions?.length) {
    for (const [idx, cond] of data.conditions.entries()) {
      await RuleCondition.create({ ...cond, companyId, ruleId: rule._id, groupId: rootGroup._id, order: idx });
    }
  }

  if (data.actions?.length) {
    for (const [idx, act] of data.actions.entries()) {
      await RuleAction.create({ ...act, companyId, ruleId: rule._id, order: idx });
    }
  }

  await createAuditLog({ companyId, userId: actorId, action: 'create', entityType: 'rule', entityId: rule._id, req });
  return formatRule(rule);
};

const updateRule = async (id, data, companyId, actorId, req) => {
  const rule = await ruleRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!rule) throw ApiError.notFound('Rule not found');
  if (rule.status === 'published') throw ApiError.badRequest('Published rule cannot be edited — clone to draft');

  const updateData = { ...data, updatedBy: actorId };
  if (data.priority) updateData.priorityOrder = RULE_PRIORITY_ORDER[data.priority] || 2;

  const updated = await ruleRepository.updateById(id, updateData, { companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'update', entityType: 'rule', entityId: id, req });
  return formatRule(updated);
};

const publishRule = async (id, companyId, actorId, req) => {
  const rule = await ruleRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!rule) throw ApiError.notFound('Rule not found');

  const updated = await ruleRepository.updateById(
    id,
    { status: 'published', version: rule.version + 1, publishedAt: new Date(), publishedBy: actorId },
    { companyId }
  );

  await createAuditLog({ companyId, userId: actorId, action: 'rule_publish', entityType: 'rule', entityId: id, req });
  return formatRule(updated);
};

const disableRule = async (id, companyId, actorId, req) => {
  const updated = await ruleRepository.updateById(id, { status: 'disabled', isEnabled: false }, { companyId });
  if (!updated) throw ApiError.notFound('Rule not found');
  await createAuditLog({ companyId, userId: actorId, action: 'update', entityType: 'rule', entityId: id, metadata: { disabled: true }, req });
  return formatRule(updated);
};

const cloneRule = async (id, companyId, actorId, req) => {
  const source = await ruleRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!source) throw ApiError.notFound('Rule not found');

  const [groups, conditions, actions] = await Promise.all([
    RuleGroup.find({ ruleId: id, companyId }, null, { companyId }),
    RuleCondition.find({ ruleId: id, companyId }, null, { companyId }),
    RuleAction.find({ ruleId: id, companyId }, null, { companyId }),
  ]);

  const cloned = await ruleRepository.create({
    companyId,
    policyId: source.policyId,
    name: `${source.name} (Copy)`,
    ruleType: source.ruleType,
    description: source.description,
    priority: source.priority,
    priorityOrder: source.priorityOrder,
    executionMode: source.executionMode,
    stopOnFailure: source.stopOnFailure,
    status: 'draft',
    isEnabled: true,
    clonedFromId: source._id,
    createdBy: actorId,
    updatedBy: actorId,
  });

  const groupMap = new Map();
  for (const g of groups) {
    const newGroup = await RuleGroup.create({
      companyId,
      ruleId: cloned._id,
      parentGroupId: g.parentGroupId ? groupMap.get(g.parentGroupId.toString()) : null,
      logicalOperator: g.logicalOperator,
      order: g.order,
      isRoot: g.isRoot,
    });
    groupMap.set(g._id.toString(), newGroup._id);
    if (g.isRoot) await ruleRepository.updateById(cloned._id, { rootGroupId: newGroup._id }, { companyId });
  }

  for (const c of conditions) {
    await RuleCondition.create({
      companyId,
      ruleId: cloned._id,
      groupId: groupMap.get(c.groupId.toString()),
      field: c.field,
      operator: c.operator,
      value: c.value,
      order: c.order,
    });
  }

  for (const a of actions) {
    await RuleAction.create({ companyId, ruleId: cloned._id, actionType: a.actionType, params: a.params, order: a.order });
  }

  return formatRule(cloned);
};

const getRule = async (id, companyId) => {
  const rule = await ruleRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!rule) throw ApiError.notFound('Rule not found');

  const [groups, conditions, actions] = await Promise.all([
    RuleGroup.find({ ruleId: id, companyId }, null, { companyId }),
    RuleCondition.find({ ruleId: id, companyId }, null, { companyId }),
    RuleAction.find({ ruleId: id, companyId }, null, { companyId }),
  ]);

  return { ...formatRule(rule), groups, conditions, actions };
};

const listRules = async (companyId, query) => {
  const filter = { companyId };
  if (query.ruleType) filter.ruleType = query.ruleType;
  if (query.status) filter.status = query.status;
  if (query.policyId) filter.policyId = query.policyId;
  const result = await ruleRepository.findMany(filter, query, { companyId });
  return { data: result.data.map(formatRule), meta: result.meta };
};

module.exports = {
  createRule,
  updateRule,
  publishRule,
  disableRule,
  cloneRule,
  getRule,
  listRules,
  formatRule,
};
