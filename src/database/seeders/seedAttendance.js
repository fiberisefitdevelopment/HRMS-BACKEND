const Company = require('../../modules/companies/company.model');
const CompanyAttendancePolicy = require('../../modules/attendance-policies/companyAttendancePolicy.model');
const Shift = require('../../modules/shifts/shift.model');
const { dbLogger } = require('../../config/logger');

const VYTALIX_POLICY = {
  name: 'Vytalix Default Policy',
  isDefault: true,
  officeTimings: { defaultStart: '09:00 AM', defaultEnd: '06:00 PM' },
  workingDays: [1, 2, 3, 4, 5],
  gracePeriodMinutes: 15,
  regularization: {
    enabled: true,
    windowStart: '09:15 AM',
    windowEnd: '09:30 AM',
    monthlyLimit: 2,
    exceedingAction: 'half_day',
  },
  dailyWageBuffer: { enabled: false },
  workingHours: { fullDayMinutes: 510, halfDayMinutes: 270 },
  breaks: {
    rules: [
      { name: 'Lunch', type: 'lunch', start: '01:00 PM', end: '01:30 PM', durationMinutes: 30 },
      { name: 'Tea Break 1', type: 'tea_break_1', start: '11:00 AM', durationMinutes: 15 },
      { name: 'Tea Break 2', type: 'tea_break_2', start: '04:00 PM', durationMinutes: 15 },
    ],
  },
  latePolicy: { enabled: true, gracePeriodMinutes: 15, markAsLateAfterGrace: true },
  missingPunchRules: { markAbsentIfNoPunchIn: true, markMissingPunchIfNoPunchOut: true },
  autoPunchOut: { enabled: true, time: '11:00 PM' },
  futureSettings: { workFromHomeEnabled: true, outdoorDutyEnabled: false },
  status: 'active',
};

const FIBERISE_POLICY = {
  name: 'Fiberise Default Policy',
  isDefault: true,
  officeTimings: { defaultStart: '09:00 AM', defaultEnd: '06:00 PM' },
  workingDays: [1, 2, 3, 4, 5],
  gracePeriodMinutes: 15,
  regularization: {
    enabled: true,
    windowStart: '09:30 AM',
    windowEnd: '11:00 AM',
    monthlyLimit: 2,
    exceedingAction: 'half_day',
  },
  dailyWageBuffer: { enabled: true, windowStart: '09:00 AM', windowEnd: '09:30 AM' },
  workingHours: { fullDayMinutes: 510, halfDayMinutes: 270 },
  breaks: {
    rules: [
      { name: 'Lunch', type: 'lunch', start: '01:00 PM', end: '01:30 PM', durationMinutes: 30 },
      { name: 'Tea Break 1', type: 'tea_break_1', start: '11:00 AM', durationMinutes: 15 },
      { name: 'Tea Break 2', type: 'tea_break_2', start: '04:00 PM', durationMinutes: 15 },
    ],
  },
  latePolicy: { enabled: true, gracePeriodMinutes: 15, markAsLateAfterGrace: true },
  missingPunchRules: { markAbsentIfNoPunchIn: true, markMissingPunchIfNoPunchOut: true },
  autoPunchOut: { enabled: true, time: '11:00 PM' },
  futureSettings: { workFromHomeEnabled: true, outdoorDutyEnabled: false },
  status: 'active',
};

const SHIFTS = [
  {
    code: 'GENERAL',
    name: 'General Shift',
    startTime: '09:00 AM',
    endTime: '06:00 PM',
    workingDays: [1, 2, 3, 4, 5],
    breakTimings: [
      { type: 'lunch', start: '01:00 PM', end: '01:30 PM', durationMinutes: 30 },
      { type: 'tea_break_1', start: '11:00 AM', durationMinutes: 15 },
      { type: 'tea_break_2', start: '04:00 PM', durationMinutes: 15 },
    ],
  },
  {
    code: 'SALES',
    name: 'Sales Shift',
    startTime: '10:00 AM',
    endTime: '06:00 PM',
    workingDays: [1, 2, 3, 4, 5, 6],
    breakTimings: [
      { type: 'lunch', start: '01:00 PM', end: '01:30 PM', durationMinutes: 30 },
      { type: 'tea_break_1', start: '11:00 AM', durationMinutes: 15 },
      { type: 'tea_break_2', start: '04:00 PM', durationMinutes: 15 },
    ],
  },
  {
    code: 'PRODUCTION',
    name: 'Production Shift',
    startTime: '09:00 AM',
    endTime: '06:00 PM',
    workingDays: [1, 2, 3, 4, 5, 6],
    breakTimings: [
      { type: 'lunch', start: '01:00 PM', end: '01:30 PM', durationMinutes: 30 },
      { type: 'tea_break_1', start: '11:00 AM', durationMinutes: 15 },
      { type: 'tea_break_2', start: '04:00 PM', durationMinutes: 15 },
    ],
  },
];

const seedAttendancePolicies = async () => {
  const existing = await CompanyAttendancePolicy.countDocuments();
  if (existing > 0) {
    // Keep WFH flag in sync for already-seeded policies
    await CompanyAttendancePolicy.updateMany(
      {},
      { $set: { 'futureSettings.workFromHomeEnabled': true } }
    );
    dbLogger.info('Attendance policies already seeded — enabled workFromHome');
    return;
  }

  const companies = await Company.find({ companyCode: { $in: ['VYTALIX', 'FIBERISE'] } });

  for (const company of companies) {
    const policyData = company.companyCode === 'VYTALIX' ? VYTALIX_POLICY : FIBERISE_POLICY;
    const policy = await CompanyAttendancePolicy.create({ ...policyData, companyId: company._id });

    const shiftsToSeed = company.companyCode === 'FIBERISE'
      ? SHIFTS.filter((s) => s.code !== 'PRODUCTION')
      : SHIFTS;

    for (const shiftData of shiftsToSeed) {
      await Shift.create({ ...shiftData, companyId: company._id, policyId: policy._id, status: 'active' });
    }

    dbLogger.info(`Seeded attendance policy and shifts for ${company.companyName}`);
  }
};

module.exports = { seedAttendancePolicies };
