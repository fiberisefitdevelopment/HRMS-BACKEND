const ApiError = require('../../../utils/ApiError');
const { createAuditLog } = require('../../../helpers/audit');
const { createNotification } = require('../../../helpers/notification');
const WorkflowInstance = require('../workflowInstance.model');
const WorkflowAction = require('../workflowAction.model');
const WorkflowNotification = require('../workflowNotification.model');
const approverResolver = require('./approverResolver.engine');
const { invokeCallback } = require('../registry/moduleCallback.registry');
const User = require('../../users/user.model');

const getActorRoleSlug = async (userId) => {
  const user = await User.findById(userId).populate('roleId', 'slug');
  return user?.roleId?.slug;
};

const recordAction = async ({ companyId, instanceId, levelOrder, levelId, actorId, action, comment, req, metadata }) => {
  await WorkflowAction.create({
    companyId,
    instanceId,
    levelOrder,
    levelId,
    actorId,
    action,
    comment,
    ipAddress: req?.ip,
    userAgent: req?.get?.('user-agent'),
    metadata,
  });
};

const sendWorkflowNotification = async ({ companyId, instanceId, userId, notificationType, title, message, data }) => {
  const notification = await createNotification({
    companyId,
    userId,
    type: notificationType === 'reminder' ? 'warning' : notificationType === 'approved' ? 'success' : 'action_required',
    title,
    message,
    actionUrl: `/workflow/instances/${instanceId}`,
    data,
  });

  await WorkflowNotification.create({
    companyId,
    instanceId,
    userId,
    notificationType,
    title,
    message,
    notificationId: notification?._id,
    metadata: data,
  });
};

const notifyApprovers = async (instance, message) => {
  for (const approverId of instance.currentApproverIds || []) {
    await sendWorkflowNotification({
      companyId: instance.companyId,
      instanceId: instance._id,
      userId: approverId,
      notificationType: 'approver',
      title: 'Approval Required',
      message,
      data: { workflowType: instance.workflowType, entityId: instance.entityId },
    });
  }
};

const getCurrentLevelState = (instance) =>
  (instance.levelStates || []).find(
    (ls) => ls.levelOrder === instance.currentLevelOrder && ls.status === 'pending'
  );

const advanceWorkflow = async (instance, companyId) => {
  const nextPending = (instance.levelStates || []).find((ls) => ls.status === 'pending');

  if (!nextPending) {
    const completed = await WorkflowInstance.findByIdAndUpdate(
      instance._id,
      { status: 'completed', completedAt: new Date(), currentApproverIds: [], currentLevelOrder: null },
      { new: true }
    );

    await invokeCallback(instance.workflowType, 'onCompleted', {
      instance: completed,
      companyId,
      entityId: instance.entityId,
      entityType: instance.entityType,
    });

    await sendWorkflowNotification({
      companyId,
      instanceId: instance._id,
      userId: instance.requesterId,
      notificationType: 'approved',
      title: 'Request Approved',
      message: `Your ${instance.workflowType} request has been fully approved`,
      data: { entityId: instance.entityId },
    });

    return completed;
  }

  const updated = await WorkflowInstance.findByIdAndUpdate(
    instance._id,
    {
      currentLevelOrder: nextPending.levelOrder,
      currentApproverIds: nextPending.assignedApproverIds,
      status: 'pending',
    },
    { new: true }
  );

  const requester = await User.findById(instance.requesterId);
  await notifyApprovers(
    updated,
    `${requester?.fullName || 'Employee'} submitted a ${instance.workflowType} request for your approval`
  );

  return updated;
};

const processApprove = async (instance, actorId, comment, req) => {
  const levelState = getCurrentLevelState(instance);
  if (!levelState) throw ApiError.badRequest('No pending approval level');

  const actorRole = await getActorRoleSlug(actorId);
  const canAct = await approverResolver.canUserActOnLevel(actorId, instance, levelState, actorRole);
  if (!canAct) throw ApiError.forbidden('You are not authorized to approve at this level');

  const approvedBy = [...new Set([...(levelState.approvedBy || []).map((id) => id.toString()), actorId.toString()])];

  let levelComplete = false;
  if (levelState.approvalMode === 'parallel' && (levelState.assignedApproverIds?.length || 0) > 1) {
    levelComplete = levelState.assignedApproverIds.every((id) => approvedBy.includes(id.toString()));
  } else {
    levelComplete = true;
  }

  const levelStates = instance.levelStates.map((ls) => {
    if (ls.levelOrder === instance.currentLevelOrder && ls.status === 'pending') {
      return {
        ...ls.toObject?.() || ls,
        approvedBy,
        status: levelComplete ? 'approved' : 'pending',
        completedAt: levelComplete ? new Date() : ls.completedAt,
      };
    }
    return ls;
  });
  let updated = await WorkflowInstance.findByIdAndUpdate(
    instance._id,
    { levelStates, updatedAt: new Date() },
    { new: true }
  );

  await recordAction({
    companyId: instance.companyId,
    instanceId: instance._id,
    levelOrder: levelState.levelOrder,
    levelId: levelState.levelId,
    actorId,
    action: 'approve',
    comment,
    req,
  });

  await createAuditLog({
    companyId: instance.companyId,
    userId: actorId,
    subjectUserId: instance.requesterId,
    action: 'workflow_approve',
    entityType: 'workflow_instance',
    entityId: instance._id,
    metadata: { levelOrder: levelState.levelOrder },
    req,
  });

  if (levelComplete) {
    await invokeCallback(instance.workflowType, 'onLevelApproved', {
      instance,
      companyId: instance.companyId,
      entityId: instance.entityId,
      entityType: instance.entityType,
      actorId,
      comment,
      completedLevel: levelState,
    });

    updated = await advanceWorkflow(updated, instance.companyId);
  }

  if (updated.status === 'completed') {
    await invokeCallback(instance.workflowType, 'onApproved', {
      instance: updated,
      companyId: instance.companyId,
      entityId: instance.entityId,
      entityType: instance.entityType,
      actorId,
    });
  }

  return updated;
};

const processReject = async (instance, actorId, comment, req) => {
  const levelState = getCurrentLevelState(instance);
  if (!levelState) throw ApiError.badRequest('No pending approval level');

  const actorRole = await getActorRoleSlug(actorId);
  const canAct = await approverResolver.canUserActOnLevel(actorId, instance, levelState, actorRole);
  if (!canAct) throw ApiError.forbidden('You are not authorized to reject at this level');

  const levelStates = instance.levelStates.map((ls) => {
    if (ls.levelOrder === instance.currentLevelOrder && ls.status === 'pending') {
      return { ...ls.toObject?.() || ls, status: 'rejected', completedAt: new Date() };
    }
    return ls;
  });

  const updated = await WorkflowInstance.findByIdAndUpdate(
    instance._id,
    { levelStates, status: 'rejected', completedAt: new Date(), currentApproverIds: [] },
    { new: true }
  );

  await recordAction({
    companyId: instance.companyId,
    instanceId: instance._id,
    levelOrder: levelState.levelOrder,
    levelId: levelState.levelId,
    actorId,
    action: 'reject',
    comment,
    req,
  });

  await createAuditLog({
    companyId: instance.companyId,
    userId: actorId,
    subjectUserId: instance.requesterId,
    action: 'workflow_reject',
    entityType: 'workflow_instance',
    entityId: instance._id,
    req,
  });

  await invokeCallback(instance.workflowType, 'onRejected', {
    instance: updated,
    companyId: instance.companyId,
    entityId: instance.entityId,
    entityType: instance.entityType,
    actorId,
    comment,
    completedLevel: levelState,
  });

  await sendWorkflowNotification({
    companyId: instance.companyId,
    instanceId: instance._id,
    userId: instance.requesterId,
    notificationType: 'rejected',
    title: 'Request Rejected',
    message: `Your ${instance.workflowType} request was rejected${comment ? `: ${comment}` : ''}`,
    data: { entityId: instance.entityId },
  });

  return updated;
};

const processCancel = async (instance, actorId, comment, req) => {
  const updated = await WorkflowInstance.findByIdAndUpdate(
    instance._id,
    { status: 'cancelled', completedAt: new Date(), currentApproverIds: [] },
    { new: true }
  );

  await recordAction({
    companyId: instance.companyId,
    instanceId: instance._id,
    actorId,
    action: 'cancel',
    comment,
    req,
  });

  await invokeCallback(instance.workflowType, 'onCancelled', {
    instance: updated,
    companyId: instance.companyId,
    entityId: instance.entityId,
    entityType: instance.entityType,
    actorId,
    comment,
  });

  await sendWorkflowNotification({
    companyId: instance.companyId,
    instanceId: instance._id,
    userId: instance.requesterId,
    notificationType: 'cancelled',
    title: 'Request Cancelled',
    message: `Your ${instance.workflowType} request has been cancelled`,
    data: { entityId: instance.entityId },
  });

  return updated;
};

const processDelegate = async (instance, actorId, delegateId, comment, req) => {
  const levelState = getCurrentLevelState(instance);
  if (!levelState) throw ApiError.badRequest('No pending level to delegate');

  const levelStates = instance.levelStates.map((ls) => {
    if (ls.levelOrder === instance.currentLevelOrder && ls.status === 'pending') {
      const approvers = [...(ls.assignedApproverIds || []).map((id) => id.toString())];
      const idx = approvers.indexOf(actorId.toString());
      if (idx >= 0) approvers[idx] = delegateId.toString();
      else approvers.push(delegateId.toString());
      return {
        ...ls.toObject?.() || ls,
        assignedApproverIds: [...new Set(approvers)],
        status: 'delegated',
      };
    }
    return ls;
  });

  const updated = await WorkflowInstance.findByIdAndUpdate(
    instance._id,
    { levelStates, status: 'delegated', currentApproverIds: [delegateId] },
    { new: true }
  );

  await recordAction({
    companyId: instance.companyId,
    instanceId: instance._id,
    levelOrder: levelState.levelOrder,
    levelId: levelState.levelId,
    actorId,
    action: 'delegate',
    comment,
    req,
    metadata: { delegateId },
  });

  await sendWorkflowNotification({
    companyId: instance.companyId,
    instanceId: instance._id,
    userId: delegateId,
    notificationType: 'delegated',
    title: 'Approval Delegated',
    message: `A ${instance.workflowType} approval has been delegated to you`,
    data: { entityId: instance.entityId },
  });

  return updated;
};

const processEscalate = async (instance, actorId, escalateToApproverIds, comment, req) => {
  const levelState = getCurrentLevelState(instance);
  if (!levelState) throw ApiError.badRequest('No pending level to escalate');

  const levelStates = instance.levelStates.map((ls) => {
    if (ls.levelOrder === instance.currentLevelOrder && ls.status === 'pending') {
      return {
        ...ls.toObject?.() || ls,
        assignedApproverIds: escalateToApproverIds,
        status: 'escalated',
      };
    }
    return ls;
  });

  const updated = await WorkflowInstance.findByIdAndUpdate(
    instance._id,
    { levelStates, status: 'escalated', currentApproverIds: escalateToApproverIds },
    { new: true }
  );

  await recordAction({
    companyId: instance.companyId,
    instanceId: instance._id,
    levelOrder: levelState.levelOrder,
    levelId: levelState.levelId,
    actorId,
    action: 'escalate',
    comment,
    req,
  });

  for (const uid of escalateToApproverIds) {
    await sendWorkflowNotification({
      companyId: instance.companyId,
      instanceId: instance._id,
      userId: uid,
      notificationType: 'escalated',
      title: 'Escalated Approval',
      message: `A ${instance.workflowType} request has been escalated to you`,
      data: { entityId: instance.entityId },
    });
  }

  return updated;
};

module.exports = {
  processApprove,
  processReject,
  processCancel,
  processDelegate,
  processEscalate,
  advanceWorkflow,
  notifyApprovers,
  sendWorkflowNotification,
  getCurrentLevelState,
  recordAction,
};
