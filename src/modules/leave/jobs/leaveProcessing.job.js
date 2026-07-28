const Company = require('../../companies/company.model');
const EmployeeProfile = require('../../employees/employeeProfile.model');
const CompanyLeavePolicy = require('../../leave-policies/companyLeavePolicy.model');
const RegularizationCounter = require('../../attendance/regularizationCounter.model');
const CompOffRequest = require('../../comp-off/compOffRequest.model');
const LeaveRequest = require('../leaveRequest.model');
const balanceEngine = require('../engines/balance.engine');
const ledgerEngine = require('../engines/ledger.engine');
const policyEngine = require('../engines/policy.engine');
const attendanceIntegration = require('../engines/attendanceIntegration.engine');
const reportService = require('../report.service');
const { getMonthYear } = require('../../../utils/time');
const { logger } = require('../../../config/logger');
const { LEAVE_TYPES } = require('../../../constants');
const { createAuditLog } = require('../../../helpers/audit');

const QUARTER_END_COMMENT = 'Auto-approved at quarter-end before leave credit';

/**
 * Quarter-end order (required before leave accrual credit):
 * 1) Approve pending comp-offs → credit COMP_OFF balance
 * 2) Approve pending leaves → deduct leave balance
 * 3) Credit scheduled leave types (caller)
 */
const flushPendingCompOffs = async (companyId) => {
  const { creditOnApproval } = require('../../comp-off/compOff.service');
  const pending = await CompOffRequest.find({ companyId, status: 'pending' }, null, { companyId });

  let approved = 0;
  let failed = 0;
  const errors = [];

  for (const request of pending) {
    try {
      const actorId = request.managerId || request.userId;
      request.status = 'approved';
      request.approvedAt = new Date();
      request.approvedBy = actorId;
      request.approvedComment = QUARTER_END_COMMENT;
      request.updatedBy = actorId;
      await request.save();

      await creditOnApproval(request, actorId);

      await createAuditLog({
        companyId,
        userId: actorId,
        subjectUserId: request.userId,
        action: 'comp_off_approve',
        entityType: 'comp_off_request',
        entityId: request._id,
        metadata: { comment: QUARTER_END_COMMENT, source: 'quarterly_processing' },
      });

      approved += 1;
    } catch (error) {
      failed += 1;
      errors.push({ id: String(request._id), error: error.message });
      logger.warn('Quarter-end comp-off approval failed', {
        companyId,
        requestId: request._id,
        error: error.message,
      });
    }
  }

  return { total: pending.length, approved, failed, errors };
};

const flushPendingLeaves = async (companyId) => {
  const pending = await LeaveRequest.find({ companyId, status: 'pending' }, null, { companyId });

  let approved = 0;
  let failed = 0;
  const errors = [];

  for (const leave of pending) {
    try {
      const actorId = leave.managerId || leave.userId;
      const approvals = (leave.approvals || []).map((a) => {
        const plain = a.toObject?.() || a;
        if (plain.status === 'pending') {
          return {
            ...plain,
            approverId: actorId,
            status: 'approved',
            comment: QUARTER_END_COMMENT,
            actedAt: new Date(),
          };
        }
        return plain;
      });

      leave.status = 'approved';
      leave.currentApprovalStage = 'approved';
      leave.approvedAt = new Date();
      leave.approvals = approvals.length
        ? approvals
        : [
            {
              stage: 'manager',
              approverId: actorId,
              status: 'approved',
              comment: QUARTER_END_COMMENT,
              actedAt: new Date(),
            },
          ];
      leave.updatedBy = actorId;
      await leave.save();

      await balanceEngine.deductLeave(leave, actorId);
      await attendanceIntegration.applyLeaveToAttendance(leave);

      await createAuditLog({
        companyId,
        userId: actorId,
        subjectUserId: leave.userId,
        action: 'leave_approve',
        entityType: 'leave_request',
        entityId: leave._id,
        metadata: { comment: QUARTER_END_COMMENT, source: 'quarterly_processing' },
      });

      approved += 1;
    } catch (error) {
      failed += 1;
      errors.push({ id: String(leave._id), error: error.message });
      logger.warn('Quarter-end leave approval failed', {
        companyId,
        leaveId: leave._id,
        error: error.message,
      });
    }
  }

  return { total: pending.length, approved, failed, errors };
};

const flushPendingApprovalsBeforeCredit = async (companyId) => {
  // 1) Comp-off first (credit), then 2) leaves (debit)
  const compOffs = await flushPendingCompOffs(companyId);
  const leaves = await flushPendingLeaves(companyId);
  logger.info('Quarter-end pending approvals flushed', { companyId, compOffs, leaves });
  return { compOffs, leaves };
};

const creditLeaveForEmployees = async (companyId, policy, leaveTypeCode, reason, referenceType) => {
  const config = policyEngine.getLeaveTypeConfig(policy, leaveTypeCode);
  const employees = await EmployeeProfile.find({ companyId, isDeleted: false, status: 'active' }, null, {
    companyId,
  });

  let credited = 0;
  for (const emp of employees) {
    try {
      const result = await balanceEngine.creditScheduledLeave({
        companyId,
        employeeProfileId: emp._id,
        userId: emp.userId,
        leaveType: LEAVE_TYPES[leaveTypeCode],
        leaveTypeCode,
        amount: config.creditAmount,
        reason,
        referenceType,
        referenceId: null,
        createdBy: null,
        policy,
      });
      if (!result?.skipped) credited += 1;
    } catch (error) {
      logger.warn('Leave credit failed', { employeeId: emp.employeeId, leaveTypeCode, error: error.message });
    }
  }
  return { credited, total: employees.length };
};

const resetShortLeaveBalances = async (companyId, policy) => {
  const allowance = policy.shortLeave?.monthlyAllowance ?? 1;
  const employees = await EmployeeProfile.find({ companyId, isDeleted: false, status: 'active' }, null, {
    companyId,
  });

  let reset = 0;
  for (const emp of employees) {
    await ledgerEngine.resetBalance({
      companyId,
      employeeProfileId: emp._id,
      userId: emp.userId,
      leaveType: LEAVE_TYPES.SL,
      leaveTypeCode: 'SL',
      newBalance: allowance,
      reason: 'Monthly short leave reset',
      referenceType: 'monthly_processing',
      referenceId: null,
      createdBy: null,
    });
    reset += 1;
  }
  return { reset };
};

const resetRegularizationCounters = async (companyId) => {
  const { year, month } = getMonthYear();
  const result = await RegularizationCounter.deleteMany({ companyId, year, month });
  return { deleted: result.deletedCount };
};

const runMonthlyProcessing = async () => {
  const companies = await Company.find({ status: 'active' });
  const results = [];

  for (const company of companies) {
    const policy = await CompanyLeavePolicy.findOne({ companyId: company._id, isDefault: true, status: 'active' });
    if (!policy) continue;

    const slReset = await resetShortLeaveBalances(company._id, policy);
    const regReset = await resetRegularizationCounters(company._id);
    const leaveSummary = await reportService.getMonthlySummary(
      company._id,
      new Date().getFullYear(),
      new Date().getMonth() + 1
    );

    results.push({
      companyId: company._id,
      companyCode: company.companyCode,
      shortLeaveReset: slReset,
      regularizationReset: regReset,
      leaveSummary,
      payrollSummaryPrepared: true,
      reportsGenerated: ['monthly_attendance', 'monthly_leave'],
    });

    logger.info('Monthly processing completed', { company: company.companyCode });
  }

  return { processed: results.length, results };
};

const runQuarterlyProcessing = async () => {
  const companies = await Company.find({ status: 'active' });
  const results = [];

  for (const company of companies) {
    const policy = await CompanyLeavePolicy.findOne({ companyId: company._id, isDefault: true, status: 'active' });
    if (!policy) continue;

    // End of quarter: settle pending requests before accruing new leave
    const pendingFlush = await flushPendingApprovalsBeforeCredit(company._id);

    const quarterlyTypes = policyEngine.getCreditTypesForCycle(policy, 'quarterly');
    const credits = {};

    for (const lt of quarterlyTypes) {
      credits[lt.code] = await creditLeaveForEmployees(
        company._id,
        policy,
        lt.code,
        `Quarterly ${lt.name} credit`,
        'quarterly_processing'
      );
    }

    results.push({
      companyId: company._id,
      companyCode: company.companyCode,
      pendingFlush,
      credits,
    });
    logger.info('Quarterly processing completed', { company: company.companyCode, pendingFlush });
  }

  return { processed: results.length, results };
};

const runHalfYearlyProcessing = async () => {
  const companies = await Company.find({ status: 'active' });
  const results = [];

  for (const company of companies) {
    const policy = await CompanyLeavePolicy.findOne({ companyId: company._id, isDefault: true, status: 'active' });
    if (!policy) continue;

    const pendingFlush = await flushPendingApprovalsBeforeCredit(company._id);

    const halfYearlyTypes = policyEngine.getCreditTypesForCycle(policy, 'half_yearly');
    const credits = {};

    for (const lt of halfYearlyTypes) {
      credits[lt.code] = await creditLeaveForEmployees(
        company._id,
        policy,
        lt.code,
        `Half-yearly ${lt.name} credit`,
        'half_yearly_processing'
      );
    }

    results.push({
      companyId: company._id,
      companyCode: company.companyCode,
      pendingFlush,
      credits,
    });
    logger.info('Half-yearly processing completed', { company: company.companyCode, pendingFlush });
  }

  return { processed: results.length, results };
};

module.exports = {
  runMonthlyProcessing,
  runQuarterlyProcessing,
  runHalfYearlyProcessing,
  flushPendingApprovalsBeforeCredit,
  flushPendingCompOffs,
  flushPendingLeaves,
};
