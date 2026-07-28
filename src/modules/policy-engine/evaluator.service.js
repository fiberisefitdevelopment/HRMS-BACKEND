const policyEngineFacade = require('./policyEngine.facade');
const RuleExecution = require('./ruleExecution.model');
const RuleLog = require('./ruleLog.model');

const testRules = async (companyId, ruleType, context, triggeredBy, ruleId = null) => {
  if (ruleId) {
    return policyEngineFacade.test(ruleId, companyId, context, triggeredBy);
  }

  return policyEngineFacade.evaluate({
    companyId,
    ruleType,
    context,
    triggeredBy,
    dryRun: true,
    module: ruleType,
    userId: context.userId,
    employeeProfileId: context.employeeProfileId,
  });
};

const evaluate = async (params) => policyEngineFacade.evaluate(params);

const getExecutionLogs = async (companyId, query) => {
  const filter = { companyId, dryRun: false };
  if (query.ruleId) filter.ruleId = query.ruleId;
  if (query.module) filter.module = query.module;
  if (query.status) filter.status = query.status;

  const logs = await RuleExecution.find(filter, null, { companyId })
    .sort({ createdAt: -1 })
    .limit(parseInt(query.limit, 10) || 50);

  return logs;
};

const generateReport = async (type, companyId, query) => {
  switch (type) {
    case 'usage': {
      const usage = await RuleExecution.aggregate([
        { $match: { companyId, dryRun: false } },
        { $group: { _id: '$ruleId', count: { $sum: 1 }, avgTime: { $avg: '$executionTimeMs' } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]);
      return { type, data: usage };
    }
    case 'failed': {
      const failed = await RuleExecution.find({ companyId, status: 'failed' }, null, { companyId })
        .sort({ createdAt: -1 })
        .limit(100);
      return { type, data: failed };
    }
    case 'statistics': {
      const [total, matched, failed, avgTime] = await Promise.all([
        RuleExecution.countDocuments({ companyId, dryRun: false }),
        RuleExecution.countDocuments({ companyId, dryRun: false, matched: true }),
        RuleExecution.countDocuments({ companyId, status: 'failed' }),
        RuleExecution.aggregate([
          { $match: { companyId, dryRun: false } },
          { $group: { _id: null, avg: { $avg: '$executionTimeMs' } } },
        ]),
      ]);
      return {
        type,
        data: {
          totalExecutions: total,
          matchedExecutions: matched,
          failedExecutions: failed,
          avgExecutionTimeMs: avgTime[0]?.avg || 0,
        },
      };
    }
    default:
      return { type, data: [] };
  }
};

module.exports = { testRules, evaluate, getExecutionLogs, generateReport };
