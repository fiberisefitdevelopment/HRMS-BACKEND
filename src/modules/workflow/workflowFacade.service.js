const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const templateRepository = require('./workflowTemplate.repository');
const levelRepository = require('./workflowLevel.repository');
const instanceRepository = require('./workflowInstance.repository');
const approverResolver = require('./engines/approverResolver.engine');
const conditionEngine = require('./engines/condition.engine');
const executionEngine = require('./engines/execution.engine');
const WorkflowEscalation = require('./workflowEscalation.model');
const WorkflowInstance = require('./workflowInstance.model');

const startWorkflow = async ({
  workflowType,
  entityType,
  entityId,
  companyId,
  requesterId,
  employeeProfileId,
  departmentId,
  contextData = {},
  req,
}) => {
  const existing = await instanceRepository.findByEntity(entityType, entityId, companyId);
  if (existing) throw ApiError.conflict('Workflow instance already exists for this entity');

  let template = await templateRepository.findDefault(companyId, workflowType);
  if (!template) template = await templateRepository.findActive(companyId, workflowType);
  if (!template) throw ApiError.notFound(`No active workflow template for type: ${workflowType}`);

  let levels = await levelRepository.findByTemplate(template._id, companyId);
  if (!levels.length) throw ApiError.badRequest('Workflow template has no approval levels');

  levels = await conditionEngine.applyConditions(template._id, companyId, levels, contextData);

  const resolverContext = { companyId, employeeProfileId, departmentId, requesterId };
  const levelStates = [];

  for (const level of levels) {
    const approverIds = await approverResolver.resolveApprovers(level, resolverContext);
    const dueAt = level.escalationHours
      ? new Date(Date.now() + level.escalationHours * 60 * 60 * 1000)
      : null;

    levelStates.push({
      levelId: level._id,
      levelOrder: level.levelOrder,
      name: level.name,
      approverType: level.approverType,
      approvalMode: level.approvalMode,
      assignedApproverIds: approverIds,
      approvedBy: [],
      status: 'pending',
      startedAt: new Date(),
      dueAt,
    });
  }

  const firstLevel = levelStates.find((ls) => ls.status === 'pending');
  const instance = await instanceRepository.create({
    companyId,
    templateId: template._id,
    workflowType,
    entityType,
    entityId,
    requesterId,
    employeeProfileId,
    departmentId,
    currentLevelOrder: firstLevel?.levelOrder || 1,
    currentApproverIds: firstLevel?.assignedApproverIds || [],
    status: firstLevel ? 'pending' : 'completed',
    contextData,
    levelStates,
    startedAt: new Date(),
    completedAt: firstLevel ? null : new Date(),
  });

  await createAuditLog({
    companyId,
    userId: requesterId,
    subjectUserId: requesterId,
    action: 'workflow_start',
    entityType: 'workflow_instance',
    entityId: instance._id,
    metadata: { workflowType, entityType, entityId },
    req,
  });

  if (firstLevel) {
    const User = require('../users/user.model');
    const requester = await User.findById(requesterId);
    await executionEngine.notifyApprovers(
      instance,
      `${requester?.fullName || 'Employee'} submitted a ${workflowType} request for your approval`
    );
  }

  return instance;
};

const getInstance = async (id, companyId) => {
  const instance = await WorkflowInstance.findById(id, null, { companyId })
    .populate('requesterId', 'firstName lastName fullName email')
    .populate('templateId', 'name workflowType version');
  if (!instance) throw ApiError.notFound('Workflow instance not found');
  return instance;
};

const getInstanceByEntity = async (entityType, entityId, companyId) => {
  const instance = await instanceRepository.findByEntity(entityType, entityId, companyId);
  if (!instance) throw ApiError.notFound('Workflow instance not found');
  return instance;
};

const approve = async (id, actorId, comment, companyId, req) => {
  const instance = await instanceRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!instance) throw ApiError.notFound('Workflow instance not found');
  if (!['pending', 'escalated', 'delegated'].includes(instance.status)) {
    throw ApiError.badRequest('Workflow is not pending approval');
  }
  return executionEngine.processApprove(instance, actorId, comment, req);
};

const reject = async (id, actorId, comment, companyId, req) => {
  const instance = await instanceRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!instance) throw ApiError.notFound('Workflow instance not found');
  return executionEngine.processReject(instance, actorId, comment, req);
};

const cancel = async (id, actorId, comment, companyId, req) => {
  const instance = await instanceRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!instance) throw ApiError.notFound('Workflow instance not found');
  return executionEngine.processCancel(instance, actorId, comment, req);
};

const delegate = async (id, actorId, delegateId, comment, companyId, req) => {
  const instance = await instanceRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!instance) throw ApiError.notFound('Workflow instance not found');
  return executionEngine.processDelegate(instance, actorId, delegateId, comment, req);
};

const escalate = async (id, actorId, comment, companyId, req) => {
  const instance = await instanceRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!instance) throw ApiError.notFound('Workflow instance not found');

  const levelState = executionEngine.getCurrentLevelState(instance);
  const escalation = await WorkflowEscalation.findOne(
    { companyId, templateId: instance.templateId, levelId: levelState?.levelId, isActive: true },
    null,
    { companyId }
  );

  let escalateToIds = [];
  if (escalation) {
    const level = { approverType: escalation.escalateToApproverType, approverUserId: escalation.escalateToUserId, approverRoleId: escalation.escalateToRoleId };
    escalateToIds = await approverResolver.resolveApprovers(level, {
      companyId,
      employeeProfileId: instance.employeeProfileId,
      departmentId: instance.departmentId,
    });
  } else {
    const hrUsers = await approverResolver.getUsersByRoleSlug(companyId, 'hr');
    escalateToIds = hrUsers.map((u) => u._id);
  }

  if (!escalateToIds.length) throw ApiError.badRequest('No escalation target found');
  return executionEngine.processEscalate(instance, actorId, escalateToIds, comment, req);
};

const getHistory = async (instanceId, companyId) => {
  const WorkflowAction = require('./workflowAction.model');
  return WorkflowAction.find({ instanceId, companyId }, null, { companyId })
    .populate('actorId', 'firstName lastName fullName email')
    .sort({ createdAt: -1 });
};

module.exports = {
  startWorkflow,
  getInstance,
  getInstanceByEntity,
  approve,
  reject,
  cancel,
  delegate,
  escalate,
  getHistory,
};
