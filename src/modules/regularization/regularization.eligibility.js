/**
 * Regularization eligibility (company attendance policy):
 *
 * - Not applicable on weekly offs (comp-off applies instead):
 *   - 5-day (Mon–Fri): Sat & Sun
 *   - 6-day (Mon–Sat): Sunday
 * - policy.regularization.enabled must be true
 * - punch-in minute-of-day must fall in [windowStart, windowEnd]
 * - monthly used (pending + approved) < monthlyLimit → can raise as regularized
 * - if over limit → not eligible to request (exceedingAction applied only if HR forces)
 */

const { getMinutesFromDate, parseTimeToMinutes, isWithinWindow, minutesToTimeString } =
  require('../../utils/time');
const { isWeeklyOffDay } = require('../comp-off/compOff.eligibility');

const getPolicyRegularization = (shiftConfig = {}) => {
  const reg = shiftConfig.regularization || {};
  return {
    enabled: reg.enabled !== false,
    windowStart: reg.windowStart || '09:15 AM',
    windowEnd: reg.windowEnd || '09:30 AM',
    monthlyLimit: Number(reg.monthlyLimit) || 0,
    exceedingAction: reg.exceedingAction || 'half_day',
  };
};

const isPunchInWithinWindow = (punchInAt, windowStart, windowEnd) => {
  if (!punchInAt) return false;
  const punchMinutes = getMinutesFromDate(punchInAt);
  const start = parseTimeToMinutes(windowStart);
  const end = parseTimeToMinutes(windowEnd);
  return isWithinWindow(punchMinutes, start, end);
};

const resolveEligibility = ({
  policy,
  punchInAt,
  usedThisMonth = 0,
  alreadyRegularized = false,
  isWeeklyOff = false,
  workingDays = [],
}) => {
  if (isWeeklyOff) {
    const days = Array.isArray(workingDays) ? workingDays : [];
    const isFiveDay = days.length === 5 && !days.includes(0) && !days.includes(6);
    const offLabel = isFiveDay
      ? 'Saturday/Sunday (weekly off)'
      : 'Sunday (weekly off)';
    return {
      isEligible: false,
      inWindow: false,
      remaining: Math.max(0, policy.monthlyLimit - usedThisMonth),
      isWeeklyOff: true,
      message: `Regularization is not applicable on ${offLabel}. Use comp-off instead if you worked.`,
    };
  }

  if (!policy.enabled) {
    return {
      isEligible: false,
      inWindow: false,
      remaining: 0,
      isWeeklyOff: false,
      message: 'Regularization is disabled by attendance policy',
    };
  }

  if (!punchInAt) {
    return {
      isEligible: false,
      inWindow: false,
      remaining: Math.max(0, policy.monthlyLimit - usedThisMonth),
      isWeeklyOff: false,
      message: 'Punch in is required before requesting regularization',
    };
  }

  if (alreadyRegularized) {
    return {
      isEligible: false,
      inWindow: true,
      remaining: Math.max(0, policy.monthlyLimit - usedThisMonth),
      isWeeklyOff: false,
      message: 'Attendance is already regularized for this date',
    };
  }

  const inWindow = isPunchInWithinWindow(punchInAt, policy.windowStart, policy.windowEnd);
  const remaining = Math.max(0, policy.monthlyLimit - usedThisMonth);

  if (!inWindow) {
    return {
      isEligible: false,
      inWindow: false,
      remaining,
      isWeeklyOff: false,
      message: `Punch-in must be between ${policy.windowStart} and ${policy.windowEnd} to request regularization`,
    };
  }

  if (remaining <= 0) {
    return {
      isEligible: false,
      inWindow: true,
      remaining: 0,
      isWeeklyOff: false,
      message: `Monthly regularization limit (${policy.monthlyLimit}) reached`,
    };
  }

  return {
    isEligible: true,
    inWindow: true,
    remaining,
    isWeeklyOff: false,
    message: `Eligible for regularization (${remaining} of ${policy.monthlyLimit} remaining this month)`,
  };
};

module.exports = {
  getPolicyRegularization,
  isPunchInWithinWindow,
  resolveEligibility,
  minutesToTimeString,
  isWeeklyOffDay,
};
