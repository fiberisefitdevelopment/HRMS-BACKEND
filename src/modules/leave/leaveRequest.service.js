const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { SYSTEM_ROLES } = require('../../constants');
const { getDateOnly, formatDateOnly } = require('../../utils/time');
const leaveRequestRepository = require('./leaveRequest.repository');
const leaveLedgerRepository = require('./leaveLedger.repository');
const leaveBalanceRepository = require('./leaveBalance.repository');
const policyEngine = require('./engines/policy.engine');
const validationEngine = require('./engines/validation.engine');
const balanceEngine = require('./engines/balance.engine');
const ledgerEngine = require('./engines/ledger.engine');
const attendanceIntegration = require('./engines/attendanceIntegration.engine');
const approvalEngine = require('./engines/approval.engine');
const { getEmployeeProfileByUser } = require('./leave.helper');
const EmployeeProfile = require('../employees/employeeProfile.model');
const {
  notifyLeaveApplied,
  notifyLeaveApproved,
  notifyLeaveRejected,
  notifyLeaveCancelled,
  notifyBalanceUpdated,
} = require('../../helpers/notification');

const formatUserRef = (user) => {
  if (!user || typeof user !== 'object') return undefined;
  const id = user._id ?? user.id;
  if (!id) return undefined;
  return {
    id,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
};

const formatId = (value) => {
  if (!value) return value;
  if (typeof value === 'object') return value._id ?? value.id ?? null;
  return value;
};

const formatDepartment = (dept) => {
  if (!dept || typeof dept !== 'object') return undefined;
  return {
    id: dept._id ?? dept.id,
    name: dept.name,
    code: dept.code,
  };
};

/** Approvals timeline only for pending leaves. Approved/rejected use root summary fields. */
const formatApprovals = (approvals = [], leaveStatus) => {
  if (leaveStatus !== 'pending') return [];

  return (approvals || [])
    .map((a) => {
      const plain = a.toObject?.() || a;
      if (plain.status === 'rejected' || plain.status === 'approved') return null;
      const approverRef = formatUserRef(plain.approverId);
      return {
        stage: plain.stage,
        status: plain.status,
        comment: plain.comment || null,
        actedAt: plain.actedAt || null,
        approverId: approverRef?.id ?? (typeof plain.approverId === 'object' ? null : plain.approverId),
        approver: approverRef || null,
      };
    })
    .filter(Boolean);
};

const formatLeave = (l) => {
  const userRef = formatUserRef(l.userId);
  const employeeRef =
    l.employeeProfileId && typeof l.employeeProfileId === 'object' && l.employeeProfileId.employeeId != null
      ? {
          id: l.employeeProfileId._id ?? l.employeeProfileId.id,
          employeeId: l.employeeProfileId.employeeId,
        }
      : undefined;

  const rawApprovals = (l.approvals || []).map((a) => a.toObject?.() || a);
  const approvedEntry = rawApprovals.find((a) => a.status === 'approved');
  const rejectedEntry = rawApprovals.find((a) => a.status === 'rejected');
  const approvals = formatApprovals(l.approvals, l.status);

  const department =
    l.departmentId && typeof l.departmentId === 'object' && l.departmentId.name
      ? formatDepartment(l.departmentId)
      : undefined;

  return {
    id: l._id,
    companyId: formatId(l.companyId),
    employeeProfileId: formatId(l.employeeProfileId),
    userId: formatId(l.userId),
    user: userRef,
    employee: employeeRef,
    departmentId: formatId(l.departmentId),
    department: department || null,
    managerId: formatId(l.managerId),
    manager: formatUserRef(l.managerId) || null,
    leaveType: l.leaveType,
    leaveTypeCode: l.leaveTypeCode,
    startDate: l.startDate ? formatDateOnly(l.startDate) : null,
    endDate: l.endDate ? formatDateOnly(l.endDate) : null,
    totalDays: l.totalDays,
    isHalfDay: l.isHalfDay,
    halfDaySession: l.halfDaySession,
    reason: l.reason,
    attachments: l.attachments || [],
    prescription: l.prescription || (l.attachments || [])[0] || null,
    appliedOn: l.appliedOn || null,
    source: l.source || 'self',
    status: l.status,
    currentApprovalStage: l.currentApprovalStage,
    approvals,
    approvedBy:
      l.status === 'approved'
        ? formatUserRef(approvedEntry?.approverId) ||
          formatUserRef(l.approvedBy) ||
          null
        : null,
    approvedAt: l.status === 'approved' ? l.approvedAt || approvedEntry?.actedAt || null : null,
    approvedComment:
      l.status === 'approved' ? approvedEntry?.comment || l.approvedComment || null : null,
    rejectedBy:
      l.status === 'rejected'
        ? formatUserRef(l.rejectedBy) || formatUserRef(rejectedEntry?.approverId) || null
        : null,
    rejectedReason: l.status === 'rejected' ? l.rejectedReason || rejectedEntry?.comment || null : null,
    cancelledAt: l.cancelledAt || null,
    cancelledReason: l.cancelledReason || null,
    createdBy: formatId(l.createdBy),
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
};

const getActorRole = async (userId) => {
  const User = require('../users/user.model');
  const user = await User.findById(userId).populate('roleId', 'slug');
  return user?.roleId?.slug;
};

const resolveLeaveSubjectProfile = async (data, actorId, actorRole, companyId) => {
  const hasTarget = Boolean(data.employeeProfileId || data.userId);
  if (!hasTarget) {
    return {
      profile: await getEmployeeProfileByUser(actorId, companyId),
      isManualOnBehalf: false,
      source: 'self',
    };
  }

  let profile = null;
  if (data.employeeProfileId) {
    profile = await EmployeeProfile.findOne(
      { _id: data.employeeProfileId, companyId, isDeleted: false },
      null,
      { companyId }
    );
  } else {
    profile = await getEmployeeProfileByUser(data.userId, companyId);
  }

  if (!profile) throw ApiError.notFound('Employee not found');

  const subjectUserId = (profile.userId?._id || profile.userId).toString();
  if (subjectUserId === actorId.toString()) {
    return { profile, isManualOnBehalf: false, source: 'self' };
  }

  const isPrivileged = [SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(actorRole);
  if (isPrivileged) {
    return { profile, isManualOnBehalf: true, source: 'manual_hr' };
  }

  throw ApiError.forbidden('Only HR can add leave for other employees');
};

const applyManualLeave = async ({
  profile,
  actorId,
  companyId,
  source,
  effectiveCode,
  effectiveLeaveType,
  totalDays,
  isHalfDay,
  data,
  req,
}) => {
  const subjectUserId = profile.userId?._id || profile.userId;

  const leave = await leaveRequestRepository.create({
    companyId,
    employeeProfileId: profile._id,
    userId: subjectUserId,
    departmentId: profile.departmentId,
    managerId: profile.managerId,
    leaveType: effectiveLeaveType,
    leaveTypeCode: effectiveCode,
    startDate: data.startDate ? getDateOnly(data.startDate) : undefined,
    endDate: data.endDate ? getDateOnly(data.endDate) : undefined,
    totalDays,
    isHalfDay,
    halfDaySession: data.halfDaySession || null,
    reason: data.reason,
    attachments: data.attachments || [],
    prescription: data.prescription || null,
    appliedOn: new Date(),
    source,
    status: 'approved',
    currentApprovalStage: 'approved',
    approvedAt: new Date(),
    approvals: [
      {
        stage: 'manager',
        approverId: actorId,
        status: 'approved',
        comment: 'Manually added by HR',
        actedAt: new Date(),
      },
    ],
    createdBy: actorId,
    updatedBy: actorId,
  });

  await balanceEngine.deductLeave(leave, actorId);
  await attendanceIntegration.applyLeaveToAttendance(leave);
  await notifyLeaveApproved(companyId, subjectUserId, leave);
  await notifyBalanceUpdated(
    companyId,
    subjectUserId,
    effectiveCode,
    await ledgerEngine.getBalance(profile._id, companyId, effectiveCode),
    'Deducted after manual leave entry'
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId,
    action: 'leave_manual_add',
    entityType: 'leave_request',
    entityId: leave._id,
    changes: { after: formatLeave(leave) },
    metadata: { source, subjectUserId: subjectUserId.toString() },
    req,
  });

  const updated = await leaveRequestRepository.findById(leave._id, null, { companyId });
  return formatLeave(updated);
};

const applyLeave = async (data, actorId, companyId, req) => {
  const actorRole = await getActorRole(actorId);
  const { profile, isManualOnBehalf, source } = await resolveLeaveSubjectProfile(
    data,
    actorId,
    actorRole,
    companyId
  );

  const subjectUserId = profile.userId?._id || profile.userId;
  const policy = await policyEngine.getPolicy(companyId);
  const { code, leaveType } = policyEngine.resolveLeaveTypeCode(data.leaveType || data.leaveTypeCode);

  const isHalfDay = data.isHalfDay || false;
  const hasDates = data.startDate != null && data.endDate != null;
  let totalDays = data.totalDays;

  if (hasDates) {
    const computed = validationEngine.calculateLeaveDays(
      data.startDate,
      data.endDate,
      isHalfDay,
      policy
    );
    totalDays = totalDays ?? computed;
  }

  if (totalDays == null || totalDays < 0.5) {
    throw ApiError.badRequest('totalDays is required when startDate and endDate are not provided');
  }

  await validationEngine.validateLeaveRequest({
    employeeProfileId: profile._id,
    companyId,
    leaveTypeCode: code,
    startDate: data.startDate,
    endDate: data.endDate,
    isHalfDay,
    attachments: data.attachments,
    prescription: data.prescription,
    policy,
    totalDays,
  });

  let effectiveCode = code;
  let effectiveLeaveType = leaveType;

  try {
    const { applyLeaveRules } = require('../policy-engine/integrations/moduleIntegration');
    const mlBalance = await ledgerEngine.getBalance(profile._id, companyId, 'ML');
    const ruleResult = await applyLeaveRules({
      companyId,
      userId: subjectUserId,
      employeeProfileId: profile._id,
      context: {
        totalDays,
        leaveTypeCode: code,
        mlBalance,
        probationCompleted: !!profile.confirmationDate,
        userId: subjectUserId.toString(),
        employeeProfileId: profile._id.toString(),
      },
      triggeredBy: actorId,
    });

    if (ruleResult.blocked) {
      throw ApiError.badRequest(ruleResult.reason || 'Leave request blocked by policy rule');
    }

    if (ruleResult.convertToLop) {
      effectiveCode = 'LOP';
      effectiveLeaveType = 'loss_of_pay';
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }

  await balanceEngine.validateBalance(profile._id, companyId, effectiveCode, totalDays, policy);

  if (isManualOnBehalf) {
    return applyManualLeave({
      profile,
      actorId,
      companyId,
      source,
      effectiveCode,
      effectiveLeaveType,
      totalDays,
      isHalfDay,
      data,
      req,
    });
  }

  const leave = await leaveRequestRepository.create({
    companyId,
    employeeProfileId: profile._id,
    userId: subjectUserId,
    departmentId: profile.departmentId,
    managerId: profile.managerId,
    leaveType: effectiveLeaveType,
    leaveTypeCode: effectiveCode,
    startDate: data.startDate ? getDateOnly(data.startDate) : undefined,
    endDate: data.endDate ? getDateOnly(data.endDate) : undefined,
    totalDays,
    isHalfDay,
    halfDaySession: data.halfDaySession || null,
    reason: data.reason,
    attachments: data.attachments || [],
    prescription: data.prescription || null,
    appliedOn: new Date(),
    source: 'self',
    status: 'pending',
    currentApprovalStage: policy.approvalWorkflow?.stages?.[0] ?? 'manager',
    approvals: approvalEngine.buildApprovalWorkflow(policy, profile.managerId),
    createdBy: actorId,
    updatedBy: actorId,
  });

  if (profile.managerId) {
    const User = require('../users/user.model');
    const employee = await User.findById(subjectUserId).select('fullName firstName lastName');
    const employeeName = employee?.fullName || employee?.firstName || 'Employee';
    await notifyLeaveApplied(companyId, profile.managerId, leave, employeeName);
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: subjectUserId,
    action: 'leave_apply',
    entityType: 'leave_request',
    entityId: leave._id,
    changes: { after: formatLeave(leave) },
    req,
  });

  return formatLeave(leave);
};

const closeLegacyWorkflowInstance = async (leave, companyId) => {
  if (!leave.workflowInstanceId) return;
  try {
    const WorkflowInstance = require('../workflow/workflowInstance.model');
    await WorkflowInstance.updateOne(
      { _id: leave.workflowInstanceId, companyId },
      {
        $set: {
          status: 'cancelled',
          completedAt: new Date(),
          currentApproverIds: [],
        },
      },
      { companyId }
    );
  } catch {
    // Legacy cleanup only — leave approval is source of truth
  }
};

const cancelLeave = async (id, reason, actorId, companyId, req) => {
  const leave = await leaveRequestRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!leave) throw ApiError.notFound('Leave request not found');

  const isOwner = leave.userId.toString() === actorId.toString();

  // Only the applicant can cancel; HR/manager approve or reject instead
  if (!isOwner) throw ApiError.forbidden('You can only cancel your own leave requests');
  if (leave.status === 'cancelled') throw ApiError.badRequest('Leave already cancelled');
  if (leave.status === 'rejected') throw ApiError.badRequest('Cannot cancel a rejected leave');
  if (leave.status !== 'pending') {
    throw ApiError.badRequest('Only pending leave requests can be cancelled');
  }

  await leaveRequestRepository.updateById(
    id,
    {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason || 'Cancelled by requester',
      currentApprovalStage: null,
      updatedBy: actorId,
    },
    { companyId }
  );

  await closeLegacyWorkflowInstance(leave, companyId);
  await notifyLeaveCancelled(companyId, leave.userId, leave);

  const updated = await leaveRequestRepository.findById(id, null, { companyId });

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: leave.userId,
    action: 'leave_cancel',
    entityType: 'leave_request',
    entityId: id,
    metadata: { reason },
    req,
  });

  return formatLeave(updated);
};

const approveLeave = async (id, comment, actorId, companyId, req) => {
  const leave = await leaveRequestRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!leave) throw ApiError.notFound('Leave request not found');

  const actorRole = await getActorRole(actorId);
  const stage = approvalEngine.canApprove(leave, actorId, actorRole);
  const result = approvalEngine.processApproval(leave, stage, actorId, comment);

  await leaveRequestRepository.updateById(
    id,
    {
      ...result,
      updatedBy: actorId,
      updatedAt: new Date(),
    },
    { companyId }
  );

  await balanceEngine.deductLeave(leave, actorId);
  const updated = await leaveRequestRepository.findById(id, null, { companyId });
  await attendanceIntegration.applyLeaveToAttendance(updated);
  await notifyLeaveApproved(companyId, leave.userId, updated);
  await notifyBalanceUpdated(
    companyId,
    leave.userId,
    leave.leaveTypeCode,
    await ledgerEngine.getBalance(leave.employeeProfileId, companyId, leave.leaveTypeCode),
    'Deducted after approval'
  );

  await closeLegacyWorkflowInstance(leave, companyId);

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: leave.userId,
    action: 'leave_approve',
    entityType: 'leave_request',
    entityId: id,
    metadata: { comment },
    req,
  });

  return getLeave(id, companyId, { id: actorId });
};

const rejectLeave = async (id, comment, actorId, companyId, req) => {
  const leave = await leaveRequestRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!leave) throw ApiError.notFound('Leave request not found');

  const actorRole = await getActorRole(actorId);
  const stage = approvalEngine.canApprove(leave, actorId, actorRole);
  const result = approvalEngine.processRejection(leave, stage, actorId, comment);

  await leaveRequestRepository.updateById(
    id,
    {
      ...result,
      updatedBy: actorId,
      updatedAt: new Date(),
    },
    { companyId }
  );

  await notifyLeaveRejected(companyId, leave.userId, leave, comment);
  await closeLegacyWorkflowInstance(leave, companyId);

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: leave.userId,
    action: 'leave_reject',
    entityType: 'leave_request',
    entityId: id,
    metadata: { comment },
    req,
  });

  return getLeave(id, companyId, { id: actorId });
};

const getLeave = async (id, companyId, requester) => {
  const leave = await leaveRequestRepository.findOneDetailed(
    { _id: id, companyId },
    { companyId }
  );

  if (!leave) throw ApiError.notFound('Leave request not found');

  const actorRole = await getActorRole(requester.id);
  const leaveUserId = leave.userId?._id?.toString() || leave.userId?.toString();
  if (actorRole === SYSTEM_ROLES.EMPLOYEE && leaveUserId !== requester.id.toString()) {
    throw ApiError.forbidden('Access denied');
  }

  return formatLeave(leave);
};

const listLeaves = async (companyId, query, requester) => {
  const filter = { companyId };
  const actorRole = await getActorRole(requester.id);

  if (query.status) filter.status = query.status;
  if (query.leaveTypeCode) filter.leaveTypeCode = query.leaveTypeCode.toUpperCase();
  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.employeeProfileId) filter.employeeProfileId = query.employeeProfileId;
  if (query.startDate) filter.startDate = { $gte: new Date(query.startDate) };
  if (query.endDate) filter.endDate = { $lte: new Date(query.endDate) };

  if (actorRole === SYSTEM_ROLES.EMPLOYEE) {
    filter.userId = requester.id;
  } else if (actorRole === SYSTEM_ROLES.MANAGER) {
    if (query.scope === 'self') {
      filter.userId = requester.id;
    } else if (!query.all) {
      filter.managerId = requester.id;
    }
  }

  const result = await leaveRequestRepository.findWithFilters(filter, query, { companyId });
  return {
    data: result.data.map(formatLeave),
    meta: result.meta,
  };
};

const assertBalanceAccess = async (targetUserId, requester) => {
  const actorRole = await getActorRole(requester.id);
  const targetId = targetUserId.toString();
  const requesterId = requester.id.toString();

  if (targetId === requesterId) return;

  if (actorRole === SYSTEM_ROLES.EMPLOYEE) {
    throw ApiError.forbidden('Access denied');
  }

  if (actorRole === SYSTEM_ROLES.MANAGER) {
    const User = require('../users/user.model');
    const targetUser = await User.findById(targetUserId).select('managerId');
    if (!targetUser || targetUser.managerId?.toString() !== requesterId) {
      throw ApiError.forbidden('Access denied');
    }
    return;
  }

  if (![SYSTEM_ROLES.HR, SYSTEM_ROLES.OWNER].includes(actorRole)) {
    throw ApiError.forbidden('Access denied');
  }
};

const getBalances = async (userId, companyId, requester) => {
  await assertBalanceAccess(userId, requester);
  const profile = await getEmployeeProfileByUser(userId, companyId);
  return ledgerEngine.getAllBalances(profile._id, companyId);
};

const getLedger = async (userId, companyId, query) => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const result = await leaveLedgerRepository.findByEmployee(profile._id, companyId, query);
  return {
    data: result.data.map((e) => ({
      id: e._id,
      leaveType: e.leaveType,
      leaveTypeCode: e.leaveTypeCode,
      transactionType: e.transactionType,
      openingBalance: e.openingBalance,
      credit: e.credit,
      debit: e.debit,
      adjustment: e.adjustment,
      closingBalance: e.closingBalance,
      reason: e.reason,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      transactionDate: e.transactionDate,
    })),
    meta: result.meta,
  };
};

const getEmployeeBalances = async (employeeProfileId, companyId) =>
  ledgerEngine.getAllBalances(employeeProfileId, companyId);

const bulkApplyLeave = async (data, actorId, companyId, req) => {
  const actorRole = await getActorRole(actorId);
  if (![SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(actorRole)) {
    throw ApiError.forbidden('Only HR can bulk-add leave for employees');
  }

  const results = { success: 0, failed: 0, leaves: [], errors: [] };
  const { employeeProfileIds, ...leaveFields } = data;

  for (const employeeProfileId of employeeProfileIds) {
    try {
      const leave = await applyLeave(
        { ...leaveFields, employeeProfileId },
        actorId,
        companyId,
        req
      );
      results.success += 1;
      results.leaves.push(leave);
    } catch (error) {
      results.failed += 1;
      results.errors.push({
        employeeProfileId,
        message: error.message || 'Failed to add leave',
      });
    }
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'leave_bulk_manual_add',
    entityType: 'leave_request',
    metadata: {
      success: results.success,
      failed: results.failed,
      count: employeeProfileIds.length,
    },
    req,
  });

  return results;
};

/**
 * HR/Owner credits leave balance for an employee (adds days — does not create a leave request).
 */
const creditLeaveBalance = async (data, actorId, companyId, req) => {
  const actorRole = await getActorRole(actorId);
  if (![SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(actorRole)) {
    throw ApiError.forbidden('Only HR can credit leave balances');
  }

  const profile = await EmployeeProfile.findOne(
    { _id: data.employeeProfileId, companyId, isDeleted: false },
    null,
    { companyId }
  );
  if (!profile) throw ApiError.notFound('Employee not found');

  const policy = await policyEngine.getPolicy(companyId);
  const { code, leaveType } = policyEngine.resolveLeaveTypeCode(data.leaveType || data.leaveTypeCode);
  const config = policyEngine.getLeaveTypeConfig(policy, code);

  const amount = data.totalDays;
  if (amount == null || amount < 0.5) {
    throw ApiError.badRequest('totalDays must be at least 0.5');
  }

  const userId = profile.userId?._id || profile.userId;
  const previousBalance = await ledgerEngine.getBalance(profile._id, companyId, code);

  if (config.maxBalance != null && previousBalance + amount > config.maxBalance) {
    throw ApiError.badRequest(
      `Cannot credit ${amount} ${code}: would exceed max balance ${config.maxBalance} (current: ${previousBalance})`
    );
  }

  const { closingBalance, ledgerEntry } = await ledgerEngine.creditLeave({
    companyId,
    employeeProfileId: profile._id,
    userId,
    leaveType,
    leaveTypeCode: code,
    amount,
    reason: data.reason || 'Leave balance credited by HR',
    referenceType: 'manual_credit',
    createdBy: actorId,
  });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'leave_balance_credit',
    entityType: 'leave_balance',
    entityId: profile._id,
    metadata: {
      leaveTypeCode: code,
      credited: amount,
      previousBalance,
      balance: closingBalance,
    },
    req,
  });

  try {
    await notifyBalanceUpdated(companyId, userId, config.name || code, closingBalance, data.reason);
  } catch {
    /* non-blocking */
  }

  return {
    employeeProfileId: String(profile._id),
    leaveType,
    leaveTypeCode: code,
    credited: amount,
    previousBalance,
    balance: closingBalance,
    ledgerEntryId: ledgerEntry._id,
  };
};

const bulkCreditLeaveBalance = async (data, actorId, companyId, req) => {
  const actorRole = await getActorRole(actorId);
  if (![SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(actorRole)) {
    throw ApiError.forbidden('Only HR can bulk-credit leave balances');
  }

  const results = { success: 0, failed: 0, credits: [], errors: [] };
  const { employeeProfileIds, ...fields } = data;

  for (const employeeProfileId of employeeProfileIds) {
    try {
      const credit = await creditLeaveBalance(
        { ...fields, employeeProfileId },
        actorId,
        companyId,
        req
      );
      results.success += 1;
      results.credits.push(credit);
    } catch (error) {
      results.failed += 1;
      results.errors.push({
        employeeProfileId,
        message: error.message || 'Failed to credit leave balance',
      });
    }
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'leave_balance_bulk_credit',
    entityType: 'leave_balance',
    metadata: {
      success: results.success,
      failed: results.failed,
      count: employeeProfileIds.length,
      leaveTypeCode: data.leaveTypeCode || data.leaveType,
      totalDays: data.totalDays,
    },
    req,
  });

  return results;
};

module.exports = {
  applyLeave,
  bulkApplyLeave,
  creditLeaveBalance,
  bulkCreditLeaveBalance,
  cancelLeave,
  approveLeave,
  rejectLeave,
  getLeave,
  listLeaves,
  getBalances,
  getLedger,
  getEmployeeBalances,
  formatLeave,
};
