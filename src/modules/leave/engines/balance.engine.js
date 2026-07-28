const ledgerEngine = require('./ledger.engine');
const policyEngine = require('./policy.engine');
const ApiError = require('../../../utils/ApiError');

const validateBalance = async (employeeProfileId, companyId, leaveTypeCode, days, policy) => {
  const config = policyEngine.getLeaveTypeConfig(policy, leaveTypeCode);
  const balance = await ledgerEngine.getBalance(employeeProfileId, companyId, leaveTypeCode);

  if (leaveTypeCode === 'LOP') return { sufficient: true, balance, required: days };

  if (config.allowNegativeBalance) return { sufficient: true, balance, required: days };

  if (balance < days) {
    throw ApiError.badRequest(
      `Insufficient ${config.name} balance. Available: ${balance}, Required: ${days}`
    );
  }

  return { sufficient: true, balance, required: days };
};

const deductLeave = async (leaveRequest, actorId) => {
  const { companyId, employeeProfileId, userId, leaveType, leaveTypeCode, totalDays, _id } = leaveRequest;

  if (leaveTypeCode === 'LOP') {
    return ledgerEngine.recordTransaction({
      companyId,
      employeeProfileId,
      userId,
      leaveType,
      leaveTypeCode,
      transactionType: 'debit',
      debit: totalDays,
      reason: `LOP for leave request`,
      referenceType: 'leave_request',
      referenceId: _id,
      createdBy: actorId,
      allowNegative: true,
    });
  }

  return ledgerEngine.debitLeave({
    companyId,
    employeeProfileId,
    userId,
    leaveType,
    leaveTypeCode,
    amount: totalDays,
    reason: `Leave approved`,
    referenceType: 'leave_request',
    referenceId: _id,
    createdBy: actorId,
  });
};

const creditScheduledLeave = async ({ companyId, employeeProfileId, userId, leaveType, leaveTypeCode, amount, reason, referenceType, referenceId, createdBy, policy }) => {
  const config = policyEngine.getLeaveTypeConfig(policy, leaveTypeCode);
  const currentBalance = await ledgerEngine.getBalance(employeeProfileId, companyId, leaveTypeCode);

  let creditAmount = amount;
  if (config.maxBalance != null) {
    const headroom = config.maxBalance - currentBalance;
    creditAmount = Math.min(amount, Math.max(0, headroom));
  }

  if (creditAmount <= 0) return { skipped: true, reason: 'Max balance reached' };

  return ledgerEngine.creditLeave({
    companyId,
    employeeProfileId,
    userId,
    leaveType,
    leaveTypeCode,
    amount: creditAmount,
    reason,
    referenceType,
    referenceId,
    createdBy,
  });
};

const restoreLeave = async (leaveRequest, actorId) => {
  if (leaveRequest.leaveTypeCode === 'LOP') return null;

  return ledgerEngine.creditLeave({
    companyId: leaveRequest.companyId,
    employeeProfileId: leaveRequest.employeeProfileId,
    userId: leaveRequest.userId,
    leaveType: leaveRequest.leaveType,
    leaveTypeCode: leaveRequest.leaveTypeCode,
    amount: leaveRequest.totalDays,
    reason: 'Leave cancelled — balance restored',
    referenceType: 'leave_request',
    referenceId: leaveRequest._id,
    createdBy: actorId,
  });
};

module.exports = { validateBalance, deductLeave, creditScheduledLeave, restoreLeave };
