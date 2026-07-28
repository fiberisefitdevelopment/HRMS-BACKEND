const crypto = require('crypto');
const Rule = require('../rule.model');
const RuleGroup = require('../ruleGroup.model');
const RuleCondition = require('../ruleCondition.model');
const RuleAction = require('../ruleAction.model');
const RuleExecution = require('../ruleExecution.model');
const RuleLog = require('../ruleLog.model');
const Policy = require('../policy.model');
const { RULE_PRIORITY_ORDER } = require('../../../constants');
const conditionEvaluator = require('./conditionEvaluator.engine');
const actionExecutor = require('./actionExecutor.engine');

const loadPublishedRules = async (companyId, ruleType, policyId = null) => {
  const filter = {
    companyId,
    ruleType,
    status: 'published',
    isEnabled: true,
  };
  if (policyId) filter.policyId = policyId;

  const now = new Date();
  const rules = await Rule.find(filter, null, { companyId }).sort({ priorityOrder: 1, createdAt: 1 });

  return rules.filter((r) => {
    if (r.effectiveFrom && r.effectiveFrom > now) return false;
    if (r.effectiveTo && r.effectiveTo < now) return false;
    return true;
  });
};

const loadRuleDefinition = async (ruleId, companyId) => {
  const [groups, conditions, actions] = await Promise.all([
    RuleGroup.find({ ruleId, companyId }, null, { companyId }).sort({ order: 1 }),
    RuleCondition.find({ ruleId, companyId }, null, { companyId }).sort({ order: 1 }),
    RuleAction.find({ ruleId, companyId }, null, { companyId }).sort({ order: 1 }),
  ]);
  return { groups, conditions, actions };
};

const evaluateRule = async (rule, context, ctx) => {
  const start = Date.now();
  const { groups, conditions, actions } = await loadRuleDefinition(rule._id, rule.companyId);
  const matched = conditionEvaluator.evaluateRuleConditions(groups, conditions, context);

  let actionResults = [];
  let blocked = false;
  let outputs = {};

  if (matched && actions.length) {
    const execResult = await actionExecutor.executeActions(actions, {
      ...ctx,
      ruleId: rule._id,
      context,
      stopOnFailure: rule.stopOnFailure,
      continueOnFailure: rule.continueOnFailure,
    });
    actionResults = execResult.results;
    blocked = execResult.blocked;
    outputs = actionResults.reduce((acc, r) => ({ ...acc, ...(r.output || {}) }), {});
  }

  return {
    ruleId: rule._id,
    ruleName: rule.name,
    matched,
    blocked,
    actionsExecuted: actionResults.map((r) => r.actionType),
    outputs,
    actionResults,
    executionTimeMs: Date.now() - start,
  };
};

const evaluateRules = async ({
  companyId,
  ruleType,
  context,
  policyId = null,
  module = ruleType,
  employeeProfileId = null,
  userId = null,
  triggeredBy = null,
  dryRun = false,
}) => {
  const batchId = crypto.randomUUID();
  const rules = await loadPublishedRules(companyId, ruleType, policyId);
  const ctx = { companyId, module, employeeProfileId, userId, triggeredBy, dryRun, context };

  const ruleResults = [];
  let finalOutput = {};
  let blocked = false;
  let warnings = [];

  const sequential = rules.every((r) => r.executionMode !== 'parallel');

  if (sequential) {
    for (const rule of rules) {
      const result = await evaluateRule(rule, context, ctx);
      ruleResults.push(result);
      if (result.matched) {
        finalOutput = { ...finalOutput, ...result.outputs };
        warnings = warnings.concat(result.actionResults.filter((a) => a.warnings).flatMap((a) => a.warnings));
        if (result.blocked) {
          blocked = true;
          if (rule.stopOnFailure) break;
        }
      }
    }
  } else {
    const parallelResults = await Promise.all(rules.map((rule) => evaluateRule(rule, context, ctx)));
    for (const result of parallelResults) {
      ruleResults.push(result);
      if (result.matched) {
        finalOutput = { ...finalOutput, ...result.outputs };
        if (result.blocked) blocked = true;
      }
    }
  }

  if (!dryRun) {
    for (const result of ruleResults) {
      const execution = await RuleExecution.create({
        companyId,
        executionBatchId: batchId,
        ruleId: result.ruleId,
        ruleType,
        module,
        employeeProfileId,
        userId,
        triggeredBy,
        context,
        result: result.outputs,
        matched: result.matched,
        actionsExecuted: result.actionsExecuted,
        dryRun: false,
        status: result.blocked ? 'partial' : 'success',
        executionTimeMs: result.executionTimeMs,
      });

      await RuleLog.create({
        companyId,
        executionId: execution._id,
        ruleId: result.ruleId,
        ruleName: result.ruleName,
        module,
        affectedUserId: userId,
        triggeredBy,
        executionResult: result,
        executionTimeMs: result.executionTimeMs,
        dryRun: false,
      });
    }
  }

  return {
    batchId,
    dryRun,
    matchedRules: ruleResults.filter((r) => r.matched).length,
    totalRules: rules.length,
    blocked,
    warnings,
    outputs: finalOutput,
    ruleResults,
  };
};

const testRule = async (ruleId, companyId, context, triggeredBy) => {
  const rule = await Rule.findOne({ _id: ruleId, companyId }, null, { companyId });
  if (!rule) throw new Error('Rule not found');

  const result = await evaluateRule(rule, context, {
    companyId,
    module: rule.ruleType,
    triggeredBy,
    dryRun: true,
    context,
  });

  return { dryRun: true, ...result };
};

const resolvePolicy = async (companyId, policyType, employeeProfileId = null, departmentId = null) => {
  const now = new Date();
  let policy = await Policy.findOne(
    { companyId, policyType, status: 'published', isDefault: true },
    null,
    { companyId }
  );

  if (employeeProfileId) {
    const assigned = await Policy.findOne(
      {
        companyId,
        policyType,
        status: 'published',
        assignedEmployeeProfileIds: employeeProfileId,
        $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: now } }],
      },
      null,
      { companyId }
    );
    if (assigned) policy = assigned;
  }

  if (departmentId && !policy) {
    const deptPolicy = await Policy.findOne(
      {
        companyId,
        policyType,
        status: 'published',
        assignedDepartmentIds: departmentId,
      },
      null,
      { companyId }
    );
    if (deptPolicy) policy = deptPolicy;
  }

  return policy;
};

module.exports = {
  evaluateRules,
  evaluateRule,
  testRule,
  resolvePolicy,
  loadPublishedRules,
};
