const CompanyLeavePolicy = require('../../leave-policies/companyLeavePolicy.model');
const LeaveBalance = require('../leaveBalance.model');
const ledgerEngine = require('../engines/ledger.engine');
const { LEAVE_TYPES } = require('../../../constants');

const initializeLeaveBalances = async (profile, userId, companyId, options = {}) => {
  const { skipExisting = true, reason = 'Initial leave balance' } = options;

  if (!profile?._id) return { skipped: true, reason: 'Missing profile' };

  const policy = await CompanyLeavePolicy.findOne(
    { companyId, isDefault: true, status: 'active' },
    null,
    { companyId }
  );
  if (!policy) return { skipped: true, reason: 'No active leave policy' };

  const credited = [];

  for (const leaveType of policy.leaveTypes) {
    if (!leaveType.isActive || leaveType.code === 'LOP') continue;

    let amount = leaveType.creditAmount;
    if (leaveType.code === 'SL') {
      amount = policy.shortLeave?.monthlyAllowance ?? 1;
    }
    if (amount <= 0) continue;

    if (skipExisting) {
      const existing = await LeaveBalance.findOne(
        { companyId, employeeProfileId: profile._id, leaveTypeCode: leaveType.code.toUpperCase() },
        null,
        { companyId }
      );
      if (existing) continue;
    }

    await ledgerEngine.creditLeave({
      companyId,
      employeeProfileId: profile._id,
      userId,
      leaveType: leaveType.leaveType || LEAVE_TYPES[leaveType.code],
      leaveTypeCode: leaveType.code,
      amount,
      reason,
      referenceType: 'system',
      referenceId: null,
      createdBy: null,
    });

    credited.push({ code: leaveType.code, amount });
  }

  return { credited };
};

module.exports = { initializeLeaveBalances };
