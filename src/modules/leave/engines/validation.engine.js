const leaveRequestRepository = require('../leaveRequest.repository');
const attendanceRepository = require('../../attendance/attendance.repository');
const RegularizationRequest = require('../../regularization/regularizationRequest.model');
const WfhRequest = require('../../wfh/wfhRequest.model');
const policyEngine = require('./policy.engine');
const ApiError = require('../../../utils/ApiError');
const { getDateOnly, eachDayInRange, countDaysInclusive, formatDateOnly } = require('../../../utils/time');

const calculateLeaveDays = (startDate, endDate, isHalfDay, policy) => {
  if (!startDate || !endDate) return null;
  if (isHalfDay) return 0.5;

  const days = eachDayInRange(startDate, endDate);
  if (!policy.workingDaysForLeave?.excludeWeekends) {
    return days.length;
  }

  return days.filter((d) => policyEngine.isWorkingDayForLeave(policy, d)).length;
};

const validateDateRange = (startDate, endDate) => {
  const start = getDateOnly(startDate);
  const end = getDateOnly(endDate);
  if (end < start) throw ApiError.badRequest('End date must be on or after start date');
  return { start, end };
};

const validateNoOverlap = async (employeeProfileId, companyId, startDate, endDate, excludeId = null) => {
  if (!startDate || !endDate) return;
  const overlapping = await leaveRequestRepository.findOverlapping(
    employeeProfileId,
    companyId,
    startDate,
    endDate,
    excludeId
  );
  if (overlapping.length > 0) {
    const existing = overlapping[0];
    let covered = formatDateOnly(startDate);
    if (existing.startDate && existing.endDate) {
      const from = formatDateOnly(existing.startDate);
      const to = formatDateOnly(existing.endDate);
      covered = from === to ? from : `${from} to ${to}`;
    }
    throw ApiError.conflict(
      `Cannot apply multiple leaves on the same day. A pending or approved leave already covers ${covered}`
    );
  }
};

const validateHolidays = (policy, startDate, endDate) => {
  const days = eachDayInRange(startDate, endDate);
  const holidays = days.filter((d) => policyEngine.isHoliday(policy, d));
  if (holidays.length === days.length) {
    throw ApiError.badRequest('Selected date range falls entirely on holidays');
  }
};

const validateWeeklyOffs = (policy, startDate, endDate) => {
  const days = eachDayInRange(startDate, endDate);
  const weeklyOffDay = days.find((d) => !policyEngine.isWorkingDayForLeave(policy, d));
  if (weeklyOffDay) {
    throw ApiError.badRequest(
      `Cannot apply leave on ${formatDateOnly(weeklyOffDay)} — it is a weekly off`
    );
  }
};

const validateRegularizationConflicts = async (employeeProfileId, companyId, startDate, endDate) => {
  const days = eachDayInRange(startDate, endDate);
  for (const day of days) {
    const dayStart = getDateOnly(day);
    const existing = await RegularizationRequest.findOne(
      {
        companyId,
        employeeProfileId,
        attendanceDate: dayStart,
        status: { $in: ['pending', 'approved'] },
      },
      null,
      { companyId }
    );
    if (existing) {
      throw ApiError.conflict(
        `Cannot apply leave on ${formatDateOnly(day)} — regularization is already applied for this date`
      );
    }
  }
};

const validateWfhConflicts = async (employeeProfileId, companyId, startDate, endDate) => {
  const days = eachDayInRange(startDate, endDate);
  for (const day of days) {
    const dayStart = getDateOnly(day);
    const existing = await WfhRequest.findOne(
      {
        companyId,
        employeeProfileId,
        date: dayStart,
        status: { $in: ['pending', 'approved'] },
      },
      null,
      { companyId }
    );
    if (existing) {
      throw ApiError.conflict(
        `Cannot apply leave on ${formatDateOnly(day)} — work from home is already applied for this date`
      );
    }
  }
};

const validateAttendanceConflicts = async (employeeProfileId, companyId, startDate, endDate, isHalfDay) => {
  const days = eachDayInRange(startDate, endDate);
  for (const day of days) {
    const record = await attendanceRepository.findTodayRecord(employeeProfileId, companyId, day);
    if (!record) continue;
    if (['present', 'late', 'regularized', 'work_from_home'].includes(record.attendanceStatus) && !isHalfDay) {
      throw ApiError.conflict(
        `Attendance already marked as ${record.attendanceStatus} on ${formatDateOnly(day)}`
      );
    }
  }
};

const validateShortLeave = async (employeeProfileId, companyId, leaveTypeCode) => {
  if (leaveTypeCode !== 'SL') return;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const existing = await leaveRequestRepository.findOverlapping(
    employeeProfileId,
    companyId,
    monthStart,
    monthEnd
  );
  const shortLeaves = existing.filter((l) => l.leaveTypeCode === 'SL' && l.status !== 'cancelled');
  if (shortLeaves.length > 0) {
    throw ApiError.conflict('Short leave already used this month');
  }
};

const validateAttachment = (config, attachments, leaveTypeCode, prescription) => {
  const isMedical = leaveTypeCode === 'ML' || config?.leaveType === 'medical_leave';
  const hasPrescription = Boolean(prescription) || (attachments && attachments.length > 0);

  if (isMedical && !hasPrescription) {
    throw ApiError.badRequest('Prescription upload is required for medical leave');
  }

  if (config.requiresAttachment && (!attachments || attachments.length === 0)) {
    throw ApiError.badRequest('Attachment is required for this leave type');
  }
};

const validateLeaveRequest = async ({
  employeeProfileId,
  companyId,
  leaveTypeCode,
  startDate,
  endDate,
  isHalfDay,
  attachments,
  prescription,
  policy,
  totalDays,
}) => {
  const config = policyEngine.getLeaveTypeConfig(policy, leaveTypeCode);
  validateAttachment(config, attachments, leaveTypeCode, prescription);

  const hasDates = startDate != null && endDate != null;

  if (!hasDates) {
    if (totalDays == null || totalDays < 0.5) {
      throw ApiError.badRequest('totalDays is required when startDate and endDate are not provided');
    }
    return { config, totalDays, hasDates: false };
  }

  validateDateRange(startDate, endDate);

  if (isHalfDay && countDaysInclusive(startDate, endDate) > 1) {
    throw ApiError.badRequest('Half day leave must be for a single day');
  }

  await validateNoOverlap(employeeProfileId, companyId, startDate, endDate);
  validateHolidays(policy, startDate, endDate);
  validateWeeklyOffs(policy, startDate, endDate);
  await validateRegularizationConflicts(employeeProfileId, companyId, startDate, endDate);
  await validateWfhConflicts(employeeProfileId, companyId, startDate, endDate);
  await validateAttendanceConflicts(employeeProfileId, companyId, startDate, endDate, isHalfDay);
  await validateShortLeave(employeeProfileId, companyId, leaveTypeCode);

  const computedDays = calculateLeaveDays(startDate, endDate, isHalfDay, policy);
  if (totalDays != null && Math.abs(computedDays - totalDays) > 0.01) {
    throw ApiError.badRequest(`Total days should be ${computedDays}`);
  }

  return { config, totalDays: computedDays, hasDates: true };
};

module.exports = {
  calculateLeaveDays,
  validateLeaveRequest,
  validateNoOverlap,
  validateDateRange,
};
