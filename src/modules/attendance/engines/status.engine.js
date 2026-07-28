const shiftEngine = require('./shift.engine');
const regularizationEngine = require('./regularization.engine');
const workingHoursEngine = require('./workingHours.engine');

const determineAttendanceStatus = async (record, shiftConfig) => {
  const isWeeklyOff = !shiftEngine.isWorkingDay(shiftConfig, record.date);
  const firstPunchIn = workingHoursEngine.getFirstPunchIn(record);
  const lastPunchOut = workingHoursEngine.getLastPunchOut(record);

  // No punches on weekly off → week_off (no late)
  if (isWeeklyOff && !firstPunchIn?.timestamp) {
    return { attendanceStatus: 'week_off', lateByMinutes: 0, isRegularized: false };
  }

  if (!firstPunchIn?.timestamp) {
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

  const lateResult = regularizationEngine.evaluateLateArrival(firstPunchIn.timestamp, shiftConfig);
  const hours = workingHoursEngine.calculateWorkingHours(record, shiftConfig);
  const hoursStatus = workingHoursEngine.determineHoursStatus(hours.netWorkingMinutes, shiftConfig);

  if (!lastPunchOut?.timestamp && shiftConfig.missingPunchRules?.markMissingPunchIfNoPunchOut) {
    return {
      attendanceStatus: 'missing_punch',
      ...hours,
      lateByMinutes: lateResult.lateByMinutes,
      isRegularized: record.isRegularized || false,
    };
  }

  let attendanceStatus = hoursStatus;

  if (record.isRegularized || record.attendanceStatus === 'regularized') {
    attendanceStatus = 'regularized';
  } else if (hoursStatus === 'present' && lateResult.isLate) {
    // Late is orthogonal to hours — full-day work still stays late
    attendanceStatus = 'late';
  } else if (lateResult.isLate && hoursStatus !== 'absent' && hoursStatus !== 'half_day') {
    attendanceStatus = 'late';
  }

  if (record.isAutoPunchOut && !lastPunchOut?.timestamp) {
    attendanceStatus = 'auto_punch_out';
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
