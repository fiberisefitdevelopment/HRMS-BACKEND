const Company = require('../../modules/companies/company.model');
const Policy = require('../../modules/policy-engine/policy.model');
const ruleService = require('../../modules/policy-engine/rule.service');
const { dbLogger } = require('../../config/logger');

const ATTENDANCE_RULES = [
  {
    name: 'Present - Full Day Hours',
    ruleType: 'attendance',
    priority: 'high',
    conditions: [{ field: 'netWorkingMinutes', operator: 'gte', value: 510 }],
    actions: [{ actionType: 'set_status', params: { status: 'present', field: 'attendanceStatus' } }],
  },
  {
    name: 'Half Day - Minimum Hours',
    ruleType: 'attendance',
    priority: 'medium',
    conditions: [{ field: 'netWorkingMinutes', operator: 'between', value: [270, 509] }],
    actions: [{ actionType: 'set_status', params: { status: 'half_day', field: 'attendanceStatus' } }],
  },
  {
    name: 'Late Count Threshold',
    ruleType: 'attendance',
    priority: 'medium',
    conditions: [{ field: 'lateCount', operator: 'gte', value: 3 }],
    actions: [{ actionType: 'set_status', params: { status: 'half_day', field: 'attendanceStatus' } }],
  },
  {
    name: 'Missing Punch Out',
    ruleType: 'attendance',
    priority: 'low',
    conditions: [{ field: 'hasPunchOut', operator: 'eq', value: false }],
    actions: [{ actionType: 'trigger_attendance_update', params: { status: 'missing_punch' } }],
  },
];

const LEAVE_RULES = [
  {
    name: 'Long Leave - Owner Approval',
    ruleType: 'leave',
    priority: 'high',
    conditions: [{ field: 'totalDays', operator: 'gt', value: 5 }],
    actions: [{ actionType: 'trigger_workflow', params: { workflowType: 'leave', requireOwner: true } }],
  },
  {
    name: 'Medical Leave Zero Balance',
    ruleType: 'leave',
    priority: 'high',
    conditions: [
      { field: 'leaveTypeCode', operator: 'eq', value: 'ML' },
      { field: 'mlBalance', operator: 'eq', value: 0 },
    ],
    actions: [{ actionType: 'convert_to_lop', params: {} }],
  },
  {
    name: 'Probation EL Credit',
    ruleType: 'leave',
    priority: 'medium',
    conditions: [{ field: 'probationCompleted', operator: 'eq', value: true }],
    actions: [{ actionType: 'credit_leave', params: { leaveTypeCode: 'EL', amount: 4 } }],
  },
];

const seedPolicyEngine = async () => {
  const existing = await Policy.countDocuments();
  if (existing > 0) {
    dbLogger.info('Policy engine policies already seeded — skipping');
    return;
  }

  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });

  for (const company of companies) {
    for (const policyType of ['attendance', 'leave', 'payroll', 'workflow']) {
      const policy = await Policy.create({
        companyId: company._id,
        name: `${company.companyCode} ${policyType} Policy`,
        policyType,
        description: `Default ${policyType} policy for ${company.companyName}`,
        status: 'published',
        isDefault: true,
        version: 1,
        publishedAt: new Date(),
        config: {},
      });

      const rules = policyType === 'attendance' ? ATTENDANCE_RULES : policyType === 'leave' ? LEAVE_RULES : [];
      for (const ruleDef of rules) {
        const rule = await ruleService.createRule(
          { ...ruleDef, policyId: policy._id },
          company._id,
          null,
          null
        );
        await require('../../modules/policy-engine/rule.repository').updateById(
          rule.id,
          { status: 'published', publishedAt: new Date() },
          { companyId: company._id }
        );
      }
    }

    dbLogger.info(`Seeded policy engine for ${company.companyName}`);
  }
};

module.exports = { seedPolicyEngine };
