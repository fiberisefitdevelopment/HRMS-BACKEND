const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const templateService = require('./template.service');
const instanceService = require('./instance.service');
const reportService = require('./report.service');
const User = require('../users/user.model');

const createTemplate = catchAsync(async (req, res) => {
  const data = await templateService.createTemplate(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Workflow template created', data });
});

const updateTemplate = catchAsync(async (req, res) => {
  const data = await templateService.updateTemplate(req.params.id, req.body, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Workflow template updated', data });
});

const deleteTemplate = catchAsync(async (req, res) => {
  await templateService.deleteTemplate(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Workflow template deactivated' });
});

const getTemplate = catchAsync(async (req, res) => {
  const data = await templateService.getTemplate(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Workflow template retrieved', data });
});

const listTemplates = catchAsync(async (req, res) => {
  const result = await templateService.listTemplates(req.companyId, req.query);
  sendSuccess(res, { message: 'Workflow templates retrieved', data: result.data, meta: result.meta });
});

const createLevel = catchAsync(async (req, res) => {
  const data = await templateService.createLevel(req.params.templateId, req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Workflow level created', data });
});

const updateLevel = catchAsync(async (req, res) => {
  const data = await templateService.updateLevel(req.params.levelId, req.body, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Workflow level updated', data });
});

const deleteLevel = catchAsync(async (req, res) => {
  await templateService.deleteLevel(req.params.levelId, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Workflow level deactivated' });
});

const createCondition = catchAsync(async (req, res) => {
  const data = await templateService.createCondition(req.params.templateId, req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Workflow condition created', data });
});

const createDelegation = catchAsync(async (req, res) => {
  const data = await templateService.createDelegation(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Delegation created', data });
});

const listInstances = catchAsync(async (req, res) => {
  const result = await instanceService.listInstances(req.companyId, req.query, req.user);
  sendSuccess(res, { message: 'Workflow instances retrieved', data: result.data, meta: result.meta });
});

const getInstance = catchAsync(async (req, res) => {
  const data = await instanceService.getInstance(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Workflow instance retrieved', data: instanceService.formatInstance(data) });
});

const getHistory = catchAsync(async (req, res) => {
  const data = await instanceService.getHistory(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Workflow history retrieved', data });
});

const approve = catchAsync(async (req, res) => {
  const data = await instanceService.approve(req.params.id, req.user.id, req.body.comment, req.companyId, req);
  sendSuccess(res, { message: 'Workflow approved', data: instanceService.formatInstance(data) });
});

const reject = catchAsync(async (req, res) => {
  const data = await instanceService.reject(req.params.id, req.user.id, req.body.comment, req.companyId, req);
  sendSuccess(res, { message: 'Workflow rejected', data: instanceService.formatInstance(data) });
});

const cancel = catchAsync(async (req, res) => {
  const data = await instanceService.cancel(req.params.id, req.user.id, req.body.comment, req.companyId, req);
  sendSuccess(res, { message: 'Workflow cancelled', data: instanceService.formatInstance(data) });
});

const delegate = catchAsync(async (req, res) => {
  const data = await instanceService.delegate(req.params.id, req.user.id, req.body.delegateId, req.body.comment, req.companyId, req);
  sendSuccess(res, { message: 'Workflow delegated', data: instanceService.formatInstance(data) });
});

const escalate = catchAsync(async (req, res) => {
  const data = await instanceService.escalate(req.params.id, req.user.id, req.body.comment, req.companyId, req);
  sendSuccess(res, { message: 'Workflow escalated', data: instanceService.formatInstance(data) });
});

const getPending = catchAsync(async (req, res) => {
  const data = await instanceService.getPendingForApprover(req.companyId, req.user.id);
  sendSuccess(res, { message: 'Pending approvals', data });
});

const getDashboard = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id).populate('roleId', 'slug');
  const data = await instanceService.getDashboard(req.companyId, req.user.id, user?.roleId?.slug);
  sendSuccess(res, { message: 'Workflow dashboard', data });
});

const report = catchAsync(async (req, res) => {
  const data = await reportService.generateReport(req.params.type || 'analytics', req.companyId, req.query);
  sendSuccess(res, { message: 'Workflow report', data });
});

module.exports = {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  createLevel,
  updateLevel,
  deleteLevel,
  createCondition,
  createDelegation,
  listInstances,
  getInstance,
  getHistory,
  approve,
  reject,
  cancel,
  delegate,
  escalate,
  getPending,
  getDashboard,
  report,
};
