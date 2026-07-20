/**
 * Comp-off eligibility:
 *
 * Weekly off (day not in shift.workingDays):
 *   - 5-day (Mon–Fri): Saturday and/or Sunday
 *   - 6-day (Mon–Sat): Sunday
 *   Duration = first punch-in → last punch-out (hours worked that day)
 *
 * Working day:
 *   Duration = shift end → last punch-out (OT after shift)
 *
 * Same credit tiers for both:
 *   < 1h → 0; >= 1h and < 4h → 0.5; >= 4h → 1.0
 */

const ELIGIBILITY_TYPES = {
  WEEKLY_OFF: 'weekly_off',
  OVERTIME: 'overtime',
};

const computeEligibleDaysFromMinutes = (minutes) => {
  const value = Math.max(0, Number(minutes) || 0);
  if (value >= 240) return 1;
  if (value >= 60) return 0.5;
  return 0;
};

/** @deprecated */
const computeEligibleDaysFromOvertime = computeEligibleDaysFromMinutes;
const computeEligibleDays = computeEligibleDaysFromMinutes;

const computeOvertimeMinutes = (shiftEndAt, punchOutAt) => {
  if (!shiftEndAt || !punchOutAt) return 0;
  const end = new Date(shiftEndAt).getTime();
  const out = new Date(punchOutAt).getTime();
  if (Number.isNaN(end) || Number.isNaN(out)) return 0;
  return Math.max(0, Math.round((out - end) / 60000));
};

const computeWorkedMinutes = (punchInAt, punchOutAt) => {
  if (!punchInAt || !punchOutAt) return 0;
  const start = new Date(punchInAt).getTime();
  const out = new Date(punchOutAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(out)) return 0;
  return Math.max(0, Math.round((out - start) / 60000));
};

const formatDuration = (minutes) => {
  const m = Math.max(0, Number(minutes) || 0);
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h <= 0) return `${mins}m`;
  if (mins <= 0) return `${h}h`;
  return `${h}h ${mins}m`;
};

/**
 * True when attendance date is outside the employee's shift workingDays.
 * workingDays: 0=Sun … 6=Sat (JS getDay).
 */
const isWeeklyOffDay = (workingDays, date) => {
  const days = Array.isArray(workingDays) ? workingDays : [];
  if (!days.length) return false;
  const dayIndex = new Date(date).getDay();
  return !days.includes(dayIndex);
};

const buildEligibilityMessage = ({
  isWeeklyOff,
  durationMinutes,
  eligibleDays,
  isEligible,
}) => {
  if (isEligible) {
    if (isWeeklyOff) {
      return `Worked ${formatDuration(durationMinutes)} on weekly off — eligible for ${eligibleDays} day comp-off`;
    }
    return `Overtime ${formatDuration(durationMinutes)} after shift end — eligible for ${eligibleDays} day comp-off`;
  }

  if (isWeeklyOff) {
    return `Need at least 1 hour worked on weekly off (got ${formatDuration(durationMinutes)})`;
  }
  return `Need at least 1 hour after shift end to raise a comp-off (got ${formatDuration(durationMinutes)})`;
};

/**
 * @param {object} params
 * @param {boolean} params.isWeeklyOff
 * @param {number} params.overtimeMinutes - OT after shift end (weekday)
 * @param {number} params.workedMinutes - total worked that day (weekly off)
 * @param {boolean} params.hasPunchOut
 */
const resolveCompOffEligibility = ({
  isWeeklyOff,
  overtimeMinutes = 0,
  workedMinutes = 0,
  hasPunchOut,
}) => {
  if (!hasPunchOut) {
    return {
      durationMinutes: 0,
      eligibleDays: 0,
      eligibilityType: null,
      overtimeMinutes: 0,
      workedMinutes: 0,
    };
  }

  if (isWeeklyOff) {
    const durationMinutes = Math.max(0, Number(workedMinutes) || 0);
    const eligibleDays = computeEligibleDaysFromMinutes(durationMinutes);
    return {
      durationMinutes,
      workedMinutes: durationMinutes,
      overtimeMinutes: 0,
      eligibleDays,
      eligibilityType: eligibleDays > 0 ? ELIGIBILITY_TYPES.WEEKLY_OFF : null,
    };
  }

  const durationMinutes = Math.max(0, Number(overtimeMinutes) || 0);
  const eligibleDays = computeEligibleDaysFromMinutes(durationMinutes);
  return {
    durationMinutes,
    workedMinutes: Math.max(0, Number(workedMinutes) || 0),
    overtimeMinutes: durationMinutes,
    eligibleDays,
    eligibilityType: eligibleDays > 0 ? ELIGIBILITY_TYPES.OVERTIME : null,
  };
};

module.exports = {
  ELIGIBILITY_TYPES,
  computeEligibleDays,
  computeEligibleDaysFromOvertime,
  computeEligibleDaysFromMinutes,
  computeOvertimeMinutes,
  computeWorkedMinutes,
  formatDuration,
  isWeeklyOffDay,
  buildEligibilityMessage,
  resolveCompOffEligibility,
};
