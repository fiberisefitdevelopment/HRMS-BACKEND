const Company = require('../../companies/company.model');
const EmployeeProfile = require('../../employees/employeeProfile.model');
const CompanyLeavePolicy = require('../../leave-policies/companyLeavePolicy.model');
const RegularizationCounter = require('../../attendance/regularizationCounter.model');
const balanceEngine = require('../engines/balance.engine');
const ledgerEngine = require('../engines/ledger.engine');
const policyEngine = require('../engines/policy.engine');
const reportService = require('../report.service');
const { getMonthYear } = require('../../../utils/time');
const { logger } = require('../../../config/logger');
const { LEAVE_TYPES } = require('../../../constants');

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

    results.push({ companyId: company._id, companyCode: company.companyCode, credits });
    logger.info('Quarterly processing completed', { company: company.companyCode });
  }

  return { processed: results.length, results };
};

const runHalfYearlyProcessing = async () => {
  const companies = await Company.find({ status: 'active' });
  const results = [];

  for (const company of companies) {
    const policy = await CompanyLeavePolicy.findOne({ companyId: company._id, isDefault: true, status: 'active' });
    if (!policy) continue;

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

    results.push({ companyId: company._id, companyCode: company.companyCode, credits });
    logger.info('Half-yearly processing completed', { company: company.companyCode });
  }

  return { processed: results.length, results };
};

module.exports = { runMonthlyProcessing, runQuarterlyProcessing, runHalfYearlyProcessing };
