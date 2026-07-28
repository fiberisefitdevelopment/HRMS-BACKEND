const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const policyService = require('./policy.service');
const ruleService = require('./rule.service');
const evaluatorService = require('./evaluator.service');

const createPolicy = catchAsync(async (req, res) => {
  const data = await policyService.createPolicy(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Policy created', data });
});

const updatePolicy = catchAsync(async (req, res) => {
  const data = await policyService.updatePolicy(req.params.id, req.body, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Policy updated', data });
});

const publishPolicy = catchAsync(async (req, res) => {
  const data = await policyService.publishPolicy(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Policy published', data });
});

const archivePolicy = catchAsync(async (req, res) => {
  const data = await policyService.archivePolicy(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Policy archived', data });
});

const clonePolicy = catchAsync(async (req, res) => {
  const data = await policyService.clonePolicy(req.params.id, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Policy cloned', data });
});

const rollbackPolicy = catchAsync(async (req, res) => {
  const data = await policyService.rollbackPolicy(req.params.id, req.body.version, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Policy rolled back', data });
});

const getPolicy = catchAsync(async (req, res) => {
  const data = await policyService.getPolicy(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Policy retrieved', data });
});

const listPolicies = catchAsync(async (req, res) => {
  const result = await policyService.listPolicies(req.companyId, req.query);
  sendSuccess(res, { message: 'Policies retrieved', data: result.data, meta: result.meta });
});

const createRule = catchAsync(async (req, res) => {
  const data = await ruleService.createRule(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Rule created', data });
});

const updateRule = catchAsync(async (req, res) => {
  const data = await ruleService.updateRule(req.params.id, req.body, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Rule updated', data });
});

const publishRule = catchAsync(async (req, res) => {
  const data = await ruleService.publishRule(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Rule published', data });
});

const disableRule = catchAsync(async (req, res) => {
  const data = await ruleService.disableRule(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Rule disabled', data });
});

const cloneRule = catchAsync(async (req, res) => {
  const data = await ruleService.cloneRule(req.params.id, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Rule cloned', data });
});

const getRule = catchAsync(async (req, res) => {
  const data = await ruleService.getRule(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Rule retrieved', data });
});

const listRules = catchAsync(async (req, res) => {
  const result = await ruleService.listRules(req.companyId, req.query);
  sendSuccess(res, { message: 'Rules retrieved', data: result.data, meta: result.meta });
});

const testRules = catchAsync(async (req, res) => {
  const data = await evaluatorService.testRules(
    req.companyId,
    req.body.ruleType,
    req.body.context,
    req.user.id,
    req.body.ruleId
  );
  sendSuccess(res, { message: 'Rule test completed (dry run)', data });
});

const evaluate = catchAsync(async (req, res) => {
  const data = await evaluatorService.evaluate({
    companyId: req.companyId,
    ruleType: req.body.ruleType,
    context: req.body.context,
    policyId: req.body.policyId,
    employeeProfileId: req.body.employeeProfileId,
    userId: req.body.userId || req.user.id,
    triggeredBy: req.user.id,
    dryRun: req.body.dryRun || false,
    module: req.body.ruleType,
  });
  sendSuccess(res, { message: 'Rules evaluated', data });
});

const executionLogs = catchAsync(async (req, res) => {
  const data = await evaluatorService.getExecutionLogs(req.companyId, req.query);
  sendSuccess(res, { message: 'Execution logs retrieved', data });
});

const report = catchAsync(async (req, res) => {
  const data = await evaluatorService.generateReport(req.params.type || 'statistics', req.companyId, req.query);
  sendSuccess(res, { message: 'Policy engine report', data });
});

module.exports = {
  createPolicy,
  updatePolicy,
  publishPolicy,
  archivePolicy,
  clonePolicy,
  rollbackPolicy,
  getPolicy,
  listPolicies,
  createRule,
  updateRule,
  publishRule,
  disableRule,
  cloneRule,
  getRule,
  listRules,
  testRules,
  evaluate,
  executionLogs,
  report,
};
