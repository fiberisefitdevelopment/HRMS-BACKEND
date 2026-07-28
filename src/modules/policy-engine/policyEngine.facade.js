const ruleEvaluator = require('./engines/ruleEvaluator.engine');

const evaluate = async (params) => ruleEvaluator.evaluateRules(params);

const test = async (ruleId, companyId, context, triggeredBy) =>
  ruleEvaluator.testRule(ruleId, companyId, context, triggeredBy);

const getPolicy = async (companyId, policyType, employeeProfileId, departmentId) =>
  ruleEvaluator.resolvePolicy(companyId, policyType, employeeProfileId, departmentId);

module.exports = { evaluate, test, getPolicy };
