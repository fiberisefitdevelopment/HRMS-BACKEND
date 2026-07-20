const shiftEngine = require('./shift.engine');
const regularizationEngine = require('./regularization.engine');
const workingHoursEngine = require('./workingHours.engine');

const determineAttendanceStatus = async (record, shiftConfig) => {
  const isWeeklyOff = !shiftEngine.isWorkingDay(shiftConfig, record.date);

  // No punches on weekly off → week_off (no late)
  if (isWeeklyOff && !record.punchIn?.timestamp) {
    return { attendanceStatus: 'week_off', lateByMinutes: 0, isRegularized: false };
  }

  if (!record.punchIn?.timestamp) {
    return { attendanceStatus: 'absent', lateByMinutes: 0, isRegularized: false };
  }

  // Worked on weekly off → present, never late (comp-off path, not regularization)
  if (isWeeklyOff) {
    const hours = workingHoursEngine.calculateWorkingHours(record, shiftConfig);
    return {
      attendanceStatus: 'present',
      lateByMinutes: 0,
      isRegularized: false,
      earlyExitMinutes: 0,
      ...hours,
    };
  }

  if (!record.punchOut?.timestamp && shiftConfig.missingPunchRules?.markMissingPunchIfNoPunchOut) {
    const hours = workingHoursEngine.calculateWorkingHours(record, shiftConfig);
    return {
      attendanceStatus: 'missing_punch',
      ...hours,
      lateByMinutes: 0,
      isRegularized: record.isRegularized || false,
    };
  }

  // Regularization is request-based (/regularization) — do not auto-apply here
  const lateResult = regularizationEngine.evaluateLateArrival(record.punchIn.timestamp, shiftConfig);
  const hours = workingHoursEngine.calculateWorkingHours(record, shiftConfig);
  const hoursStatus = workingHoursEngine.determineHoursStatus(hours.netWorkingMinutes, shiftConfig);

  let attendanceStatus = hoursStatus;

  if (record.isRegularized || record.attendanceStatus === 'regularized') {
    attendanceStatus = 'regularized';
  } else if (lateResult.isLate && shiftConfig.latePolicy?.enabled) {
    attendanceStatus = lateResult.lateByMinutes > 0 ? 'late' : attendanceStatus;
  }

  if (record.isAutoPunchOut) {
    attendanceStatus = record.punchOut?.timestamp ? attendanceStatus : 'auto_punch_out';
  }

  return {
    attendanceStatus,
    lateByMinutes: lateResult.lateByMinutes,
    isRegularized: Boolean(record.isRegularized),
    regularizationMonthCount: record.regularizationMonthCount,
    earlyExitMinutes: hours.earlyExitMinutes || 0,
    ...hours,
  };
};

module.exports = { determineAttendanceStatus };
