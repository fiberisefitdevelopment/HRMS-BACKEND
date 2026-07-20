const { diffMinutes } = require('../../../utils/time');

const calculateBreakDuration = (record) => {
  let total = 0;
  if (record.lunchStart && record.lunchEnd) total += diffMinutes(record.lunchStart, record.lunchEnd);
  if (record.teaBreak1Start && record.teaBreak1End) total += diffMinutes(record.teaBreak1Start, record.teaBreak1End);
  if (record.teaBreak2Start && record.teaBreak2End) total += diffMinutes(record.teaBreak2Start, record.teaBreak2End);
  return total;
};

const getSessions = (record) => {
  if (Array.isArray(record.punchSessions) && record.punchSessions.length > 0) {
    return record.punchSessions;
  }
  if (record.punchIn?.timestamp) {
    return [{ punchIn: record.punchIn, punchOut: record.punchOut || null }];
  }
  return [];
};

const getFirstPunchIn = (record) => {
  const sessions = getSessions(record);
  const first = sessions.find((s) => s.punchIn?.timestamp);
  return first?.punchIn || null;
};

const getLastPunchOut = (record) => {
  const sessions = getSessions(record);
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    if (sessions[i].punchOut?.timestamp) return sessions[i].punchOut;
  }
  return null;
};

const hasOpenSession = (record) => {
  const sessions = getSessions(record);
  if (sessions.length === 0) return false;
  const last = sessions[sessions.length - 1];
  return Boolean(last.punchIn?.timestamp) && !last.punchOut?.timestamp;
};

const isCurrentlyPunchedIn = (record) => hasOpenSession(record);

/**
 * Work duration = time from first punch-in to last punch-out (or now if still punched in),
 * minus break duration.
 */
const calculateWorkingHours = (record, shiftConfig) => {
  const firstPunchIn = getFirstPunchIn(record);
  if (!firstPunchIn?.timestamp) {
    return { grossWorkingMinutes: 0, breakDurationMinutes: 0, netWorkingMinutes: 0, earlyExitMinutes: 0 };
  }

  const lastPunchOut = getLastPunchOut(record);
  const endTime = lastPunchOut?.timestamp || (hasOpenSession(record) ? new Date() : firstPunchIn.timestamp);
  const grossWorkingMinutes = Math.max(0, diffMinutes(firstPunchIn.timestamp, endTime));
  const breakDurationMinutes = calculateBreakDuration(record);
  const netWorkingMinutes = Math.max(0, grossWorkingMinutes - breakDurationMinutes);

  let earlyExitMinutes = 0;
  if (lastPunchOut?.timestamp && shiftConfig && !hasOpenSession(record)) {
    const { getMinutesFromDate, parseTimeToMinutes } = require('../../../utils/time');
    const punchOutMinutes = getMinutesFromDate(lastPunchOut.timestamp);
    const shiftEnd = shiftConfig.shiftEndMinutes ?? parseTimeToMinutes(shiftConfig.shift?.endTime);
    if (shiftEnd != null && punchOutMinutes < shiftEnd) {
      earlyExitMinutes = shiftEnd - punchOutMinutes;
    }
  }

  return { grossWorkingMinutes, breakDurationMinutes, netWorkingMinutes, earlyExitMinutes };
};

const determineHoursStatus = (netWorkingMinutes, shiftConfig) => {
  const fullDay = shiftConfig.fullDayMinutes;
  const halfDay = shiftConfig.halfDayMinutes;

  if (netWorkingMinutes >= fullDay) return 'present';
  if (netWorkingMinutes >= halfDay) return 'half_day';
  return 'absent';
};

module.exports = {
  calculateBreakDuration,
  calculateWorkingHours,
  determineHoursStatus,
  getSessions,
  getFirstPunchIn,
  getLastPunchOut,
  hasOpenSession,
  isCurrentlyPunchedIn,
};
