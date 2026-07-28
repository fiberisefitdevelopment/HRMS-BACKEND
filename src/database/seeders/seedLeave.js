const Company = require('../../modules/companies/company.model');
const CompanyLeavePolicy = require('../../modules/leave-policies/companyLeavePolicy.model');
const { LEAVE_TYPES } = require('../../constants');
const { dbLogger } = require('../../config/logger');

const buildLeaveTypes = (configs) =>
  configs.map((c) => ({
    code: c.code,
    name: c.name,
    leaveType: LEAVE_TYPES[c.code],
    creditAmount: c.creditAmount,
    creditCycle: c.creditCycle,
    maxBalance: c.maxBalance ?? null,
    carryForward: c.carryForward ?? true,
    carryForwardLimit: c.carryForwardLimit ?? null,
    requiresAttachment: c.code === 'ML',
    allowNegativeBalance: c.code === 'LOP',
    isActive: true,
    approvalFlow: ['manager'],
  }));

const COMP_OFF_CONFIG = {
  code: 'COMP_OFF',
  name: 'Compensatory Off',
  creditAmount: 0,
  creditCycle: 'yearly',
  carryForward: true,
};

const VYTALIX_LEAVE_TYPES = buildLeaveTypes([
  { code: 'EL', name: 'Earned Leave', creditAmount: 4, creditCycle: 'quarterly' },
  { code: 'ML', name: 'Medical Leave', creditAmount: 6, creditCycle: 'half_yearly' },
  { code: 'CL', name: 'Casual Leave', creditAmount: 2, creditCycle: 'quarterly' },
  { code: 'SL', name: 'Short Leave', creditAmount: 1, creditCycle: 'monthly' },
  { code: 'LOP', name: 'Loss Of Pay', creditAmount: 0, creditCycle: 'yearly' },
  COMP_OFF_CONFIG,
]);

const FIBERISE_LEAVE_TYPES = buildLeaveTypes([
  { code: 'EL', name: 'Earned Leave', creditAmount: 4, creditCycle: 'quarterly' },
  { code: 'ML', name: 'Medical Leave', creditAmount: 2, creditCycle: 'quarterly' },
  { code: 'CL', name: 'Casual Leave', creditAmount: 2, creditCycle: 'quarterly' },
  { code: 'SL', name: 'Short Leave', creditAmount: 1, creditCycle: 'monthly' },
  { code: 'LOP', name: 'Loss Of Pay', creditAmount: 0, creditCycle: 'yearly' },
  COMP_OFF_CONFIG,
]);

const COMP_OFF_LEAVE_TYPE = buildLeaveTypes([COMP_OFF_CONFIG])[0];

/** Upsert COMP_OFF into every company leave policy (existing DBs skip full seed). */
const ensureCompOffLeaveType = async () => {
  const policies = await CompanyLeavePolicy.find({});
  let updated = 0;

  for (const policy of policies) {
    const hasCompOff = (policy.leaveTypes || []).some((lt) => lt.code === 'COMP_OFF');
    if (hasCompOff) continue;

    policy.leaveTypes = [...(policy.leaveTypes || []), COMP_OFF_LEAVE_TYPE];
    await policy.save();
    updated += 1;
  }

  if (updated > 0) {
    dbLogger.info(`Upserted COMP_OFF leave type into ${updated} leave polic${updated === 1 ? 'y' : 'ies'}`);
  }
};

const seedLeavePolicies = async () => {
  const existing = await CompanyLeavePolicy.countDocuments();
  if (existing > 0) {
    dbLogger.info('Leave policies already seeded — ensuring COMP_OFF');
    await ensureCompOffLeaveType();
    return;
  }

  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });

  for (const company of companies) {
    const leaveTypes = company.companyCode === 'VYTALIX' ? VYTALIX_LEAVE_TYPES : FIBERISE_LEAVE_TYPES;
    await CompanyLeavePolicy.create({
      companyId: company._id,
      name: `${company.companyName} Leave Policy`,
      isDefault: true,
      leaveTypes,
      shortLeave: { monthlyAllowance: 1, autoDeduct: true, resetMonthly: true },
      approvalWorkflow: { stages: ['manager'], hrFinalApproval: false },
      workingDaysForLeave: { excludeWeekends: false, workingDays: [1, 2, 3, 4, 5, 6] },
      status: 'active',
    });
    dbLogger.info(`Seeded leave policy for ${company.companyName}`);
  }
};

module.exports = { seedLeavePolicies, ensureCompOffLeaveType };
