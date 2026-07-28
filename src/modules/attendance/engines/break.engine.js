const ApiError = require('../../../utils/ApiError');
const { diffMinutes } = require('../../../utils/time');

const BREAK_FIELD_MAP = {
  lunch: { start: 'lunchStart', end: 'lunchEnd' },
  tea_break_1: { start: 'teaBreak1Start', end: 'teaBreak1End' },
  tea_break_2: { start: 'teaBreak2Start', end: 'teaBreak2End' },
};

const startBreak = (record, breakType) => {
  const fields = BREAK_FIELD_MAP[breakType];
  if (!fields) throw ApiError.badRequest('Invalid break type');

  if (record[fields.start]) throw ApiError.conflict(`${breakType} already started`);

  const sessions =
    Array.isArray(record.punchSessions) && record.punchSessions.length > 0
      ? record.punchSessions
      : record.punchIn?.timestamp
        ? [{ punchIn: record.punchIn, punchOut: record.punchOut }]
        : [];
  const hasOpenSession =
    sessions.length > 0 &&
    Boolean(sessions[sessions.length - 1].punchIn?.timestamp) &&
    !sessions[sessions.length - 1].punchOut?.timestamp;

  if (!hasOpenSession) throw ApiError.badRequest('Punch in required before break');

  return { [fields.start]: new Date() };
};

const endBreak = (record, breakType) => {
  const fields = BREAK_FIELD_MAP[breakType];
  if (!fields) throw ApiError.badRequest('Invalid break type');

  if (!record[fields.start]) throw ApiError.badRequest(`${breakType} not started`);
  if (record[fields.end]) throw ApiError.conflict(`${breakType} already ended`);

  return { [fields.end]: new Date() };
};

const validateBreakDuration = (start, end, maxMinutes) => {
  const duration = diffMinutes(start, end);
  if (maxMinutes && duration > maxMinutes + 5) {
    return { warning: `Break exceeded configured duration of ${maxMinutes} minutes` };
  }
  return null;
};

module.exports = {
  BREAK_FIELD_MAP,
  startBreak,
  endBreak,
  validateBreakDuration,
};
