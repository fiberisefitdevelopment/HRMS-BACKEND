const { registerWorkflowCallback } = require('../workflow/registry/moduleCallback.registry');
const leaveRequestRepository = require('./leaveRequest.repository');
const balanceEngine = require('./engines/balance.engine');
const ledgerEngine = require('./engines/ledger.engine');
const attendanceIntegration = require('./engines/attendanceIntegration.engine');
const approvalEngine = require('./engines/approval.engine');
const policyEngine = require('./engines/policy.engine');
const { notifyLeaveApproved, notifyLeaveRejected, notifyLeaveCancelled, notifyBalanceUpdated } = require('../../helpers/notification');

const syncLeaveStatus = async (entityId, companyId, status, extra = {}) => {
  await leaveRequestRepository.updateById(entityId, { status, ...extra, updatedAt: new Date() }, { companyId });
};

const mapLevelToApprovalStage = (levelState) => {
  const approverType = levelState?.approverType;
  if (approverType === 'leave_approver') return 'manager';
  if (approverType === 'reporting_manager' || approverType === 'department_manager') {
    return 'manager';
  }
  return 'manager';
};

const ensureApprovals = async (leave, companyId) => {
  if (leave.approvals?.length) return leave.approvals;
  const policy = await policyEngine.getPolicy(companyId);
  return approvalEngine.buildApprovalWorkflow(policy, leave.managerId);
};

const stageFromCurrentLeave = (leave) => {
  const pending = (leave.approvals || []).find((a) => a.status === 'pending');
  if (pending?.stage) return pending.stage;
  if (leave.currentApprovalStage && leave.currentApprovalStage !== 'approved') {
    return leave.currentApprovalStage;
  }
  return 'manager';
};

const syncLeaveApprovalProgress = async ({
  entityId,
  companyId,
  actorId,
  comment,
  completedLevel,
}) => {
  const leave = await leaveRequestRepository.findOne({ _id: entityId, companyId }, null, { companyId });
  if (!leave || leave.status !== 'pending') return;

  const approvals = await ensureApprovals(leave, companyId);
  const stage = mapLevelToApprovalStage(completedLevel);
  const result = approvalEngine.processApproval(
    { ...leave.toObject(), approvals },
    stage,
    actorId,
    comment
  );

  await leaveRequestRepository.updateById(
    entityId,
    {
      approvals: result.approvals,
      currentApprovalStage: result.currentApprovalStage,
      status: result.status,
      approvedAt: result.approvedAt,
      updatedAt: new Date(),
    },
    { companyId }
  );
};

registerWorkflowCallback('leave', {
  onLevelApproved: async ({ entityId, companyId, actorId, comment, completedLevel }) => {
    await syncLeaveApprovalProgress({
      entityId,
      companyId,
      actorId,
      comment,
      completedLevel,
    });
  },

  onApproved: async ({ entityId, companyId, actorId }) => {
    const leave = await leaveRequestRepository.findOne({ _id: entityId, companyId }, null, { companyId });
    if (!leave || leave.status === 'approved') return;

    const approvals = [
      {
        stage: 'manager',
        approverId: actorId,
        status: 'approved',
        actedAt: new Date(),
      },
    ];

    await leaveRequestRepository.updateById(
      entityId,
      {
        status: 'approved',
        currentApprovalStage: 'approved',
        approvedAt: new Date(),
        approvals,
        updatedAt: new Date(),
      },
      { companyId }
    );
    await balanceEngine.deductLeave(leave, actorId);
    const updated = await leaveRequestRepository.findById(entityId, null, { companyId });
    await attendanceIntegration.applyLeaveToAttendance(updated);
    await notifyLeaveApproved(companyId, leave.userId, updated);
    await notifyBalanceUpdated(
      companyId,
      leave.userId,
      leave.leaveTypeCode,
      await ledgerEngine.getBalance(leave.employeeProfileId, companyId, leave.leaveTypeCode),
      'Deducted after approval'
    );
  },

  onRejected: async ({ entityId, companyId, actorId, comment, completedLevel }) => {
    const leave = await leaveRequestRepository.findOne({ _id: entityId, companyId }, null, { companyId });
    if (!leave) return;

    const approvals = await ensureApprovals(leave, companyId);
    const stage = completedLevel
      ? mapLevelToApprovalStage(completedLevel)
      : stageFromCurrentLeave(leave);
    const result = approvalEngine.processRejection(
      { ...leave.toObject(), approvals },
      stage,
      actorId,
      comment
    );

    await syncLeaveStatus(entityId, companyId, 'rejected', {
      rejectedBy: actorId,
      rejectedReason: comment,
      currentApprovalStage: null,
      approvals: result.approvals,
    });
    await notifyLeaveRejected(companyId, leave.userId, leave, comment);
  },

  onCancelled: async ({ entityId, companyId, actorId, comment }) => {
    const leave = await leaveRequestRepository.findOne({ _id: entityId, companyId }, null, { companyId });
    if (!leave) return;

    if (leave.status === 'approved') {
      await balanceEngine.restoreLeave(leave, actorId);
      await attendanceIntegration.revertLeaveFromAttendance(leave);
    }

    await syncLeaveStatus(entityId, companyId, 'cancelled', {
      cancelledAt: new Date(),
      cancelledReason: comment,
      currentApprovalStage: null,
    });
    await notifyLeaveCancelled(companyId, leave.userId, leave);
  },

  onCompleted: async ({ entityId, companyId }) => {
    await syncLeaveStatus(entityId, companyId, 'approved', { approvedAt: new Date(), currentApprovalStage: 'approved' });
  },
});

const needsWorkflowSync = (leave, instance) => {
  if (!instance) return false;
  if (!leave.approvals?.length) return true;

  const managerLevel = (instance.levelStates || []).find((ls) => ls.levelOrder === 1);
  const managerApproval = leave.approvals.find((a) => a.stage === 'manager');
  if (managerLevel?.status === 'approved' && managerApproval?.status === 'pending') return true;

  const hrLevel = (instance.levelStates || []).find((ls) => ls.levelOrder === 2);
  const hrApproval = leave.approvals.find((a) => a.stage === 'hr');
  if (hrLevel?.status === 'approved' && hrApproval?.status === 'pending') return true;

  const workflowPendingLevel = (instance.levelStates || []).find((ls) => ls.status === 'pending');
  if (workflowPendingLevel && leave.status === 'pending') {
    const expectedStage = mapLevelToApprovalStage(workflowPendingLevel);
    if (leave.currentApprovalStage !== expectedStage) return true;
  }

  if (instance.status === 'completed' && leave.status === 'pending') return true;
  if (instance.status === 'rejected' && leave.status === 'pending') return true;

  return false;
};

const hydrateLeaveApprovalFromWorkflow = async (leave, companyId) => {
  if (!leave?.workflowInstanceId && !leave?._id) return leave;

  const workflowFacade = require('../workflow/workflowFacade.service');
  let instance;
  try {
    if (leave.workflowInstanceId) {
      instance = await workflowFacade.getInstance(leave.workflowInstanceId, companyId);
    } else {
      instance = await workflowFacade.getInstanceByEntity('leave_request', leave._id, companyId);
    }
  } catch {
    try {
      instance = await workflowFacade.getInstanceByEntity('leave_request', leave._id, companyId);
    } catch {
      return leave;
    }
  }

  if (!needsWorkflowSync(leave, instance)) return leave;

  let approvals = await ensureApprovals(leave, companyId);
  const plainApprovals = approvals.map((a) => ({ ...(a.toObject?.() || a) }));

  for (const levelState of instance.levelStates || []) {
    if (levelState.status !== 'approved') continue;
    const stage = mapLevelToApprovalStage(levelState);
    const idx = plainApprovals.findIndex((a) => a.stage === stage && a.status === 'pending');
    if (idx >= 0) {
      plainApprovals[idx] = {
        ...plainApprovals[idx],
        status: 'approved',
        actedAt: levelState.completedAt || new Date(),
      };
    }
  }

  const nextPending = plainApprovals.find((a) => a.status === 'pending');
  let status = leave.status;
  let currentApprovalStage = nextPending ? nextPending.stage : 'approved';
  let approvedAt = leave.approvedAt;

  const workflowPendingLevel = (instance.levelStates || []).find((ls) => ls.status === 'pending');
  if (workflowPendingLevel && status === 'pending') {
    currentApprovalStage = mapLevelToApprovalStage(workflowPendingLevel);
  }

  if (instance.status === 'completed') {
    status = 'approved';
    currentApprovalStage = 'approved';
    approvedAt = approvedAt || instance.completedAt || new Date();
  } else if (instance.status === 'rejected') {
    status = 'rejected';
    currentApprovalStage = null;
  }

  await leaveRequestRepository.updateById(
    leave._id,
    {
      approvals: plainApprovals,
      currentApprovalStage,
      status,
      approvedAt,
      updatedAt: new Date(),
    },
    { companyId }
  );

  return {
    ...leave.toObject?.() || leave,
    approvals: plainApprovals,
    currentApprovalStage,
    status,
    approvedAt,
  };
};

module.exports = {
  hydrateLeaveApprovalFromWorkflow,
};
