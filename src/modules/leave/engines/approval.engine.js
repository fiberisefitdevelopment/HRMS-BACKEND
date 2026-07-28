const ApiError = require('../../../utils/ApiError');

const DEFAULT_APPROVAL_STAGES = ['manager'];

const buildApprovalWorkflow = (policy, managerId) => {
  const stages = policy.approvalWorkflow?.stages?.length
    ? [policy.approvalWorkflow.stages[0]]
    : DEFAULT_APPROVAL_STAGES;
  return stages.map((stage) => ({
    stage,
    approverId: stage === 'manager' ? managerId : null,
    status: 'pending',
    comment: null,
    actedAt: null,
  }));
};

const getCurrentStage = (leaveRequest) => {
  if (leaveRequest.status === 'approved') return 'approved';
  if (leaveRequest.status === 'rejected' || leaveRequest.status === 'cancelled') return null;

  const pending = (leaveRequest.approvals || []).find((a) => a.status === 'pending');
  return pending?.stage || 'manager';
};

const canApprove = (leaveRequest, actorId, actorRole) => {
  if (leaveRequest.status !== 'pending') {
    throw ApiError.badRequest('Leave request is not pending approval');
  }

  const currentStage = getCurrentStage(leaveRequest);
  if (!currentStage || currentStage === 'approved') {
    throw ApiError.badRequest('No pending approval stage');
  }

  if (actorRole === 'owner' || actorRole === 'hr') return currentStage;

  if (actorRole === 'manager') {
    if (leaveRequest.managerId && leaveRequest.managerId.toString() !== actorId.toString()) {
      throw ApiError.forbidden('You are not the manager for this employee');
    }
    return currentStage;
  }

  throw ApiError.forbidden('You are not authorized to approve this leave request');
};

const processApproval = (leaveRequest, stage, actorId, comment) => {
  const approvals = (leaveRequest.approvals || []).map((a) => {
    if (a.stage === stage || (leaveRequest.approvals || []).length === 1) {
      return { ...a.toObject?.() || a, stage: a.stage || stage, approverId: actorId, status: 'approved', comment, actedAt: new Date() };
    }
    return a;
  });

  return {
    approvals,
    currentApprovalStage: 'approved',
    status: 'approved',
    approvedAt: new Date(),
  };
};

const processRejection = (leaveRequest, stage, actorId, comment) => ({
  // Rejection is stored on the leave root — keep approvals empty to avoid duplicate UI data
  approvals: [],
  status: 'rejected',
  currentApprovalStage: null,
  rejectedBy: actorId,
  rejectedReason: comment,
});

const getNextApproverUserId = (leaveRequest) => leaveRequest.managerId ?? null;

module.exports = {
  buildApprovalWorkflow,
  getCurrentStage,
  canApprove,
  processApproval,
  processRejection,
  getNextApproverUserId,
};
