/** App timezone — all calendar / clock displays and day boundaries use IST. */
const APP_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Ensure Node's local Date getters (getHours, getDay, …) match IST even when
// the host OS / container is UTC (common in cloud). Must run before date math.
if (process.env.TZ !== APP_TIMEZONE) {
  process.env.TZ = APP_TIMEZONE;
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_NAME_TO_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const IST_PARTS_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  weekday: 'short',
});

const WEEKDAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Calendar / clock parts for a Date in Asia/Kolkata (independent of process TZ). */
const getISTParts = (date = new Date()) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError('Invalid date');
  }

  // Prefer pure offset math — never depends on Intl/ICU or process TZ.
  const istMs = d.getTime() + IST_OFFSET_MS;
  const ist = new Date(istMs);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth() + 1;
  const day = ist.getUTCDate();
  const hour = ist.getUTCHours();
  const minute = ist.getUTCMinutes();
  const second = ist.getUTCSeconds();
  // Date.UTC weekday: 0=Sun … 6=Sat
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return { year, month, day, hour, minute, second, weekday };
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().toUpperCase();
  const match12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3];
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const match24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  return 0;
};

const minutesToTimeString = (minutes) => {
  const total = ((Number(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

/**
 * Start of the IST calendar day for `date`, as a real Instant
 * (e.g. 2026-07-23 00:00 IST === 2026-07-22T18:30:00.000Z).
 */
const getDateOnly = (date = new Date()) => {
  const p = getISTParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - IST_OFFSET_MS);
};

/** YYYY-MM-DD in IST calendar. */
const formatDateOnly = (date) => {
  if (!date) return null;
  const p = getISTParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

/**
 * UTC-anchored midnight for a pure calendar date (e.g. holidays).
 * Prefer getDateOnly / formatDateOnly for attendance punch calendar days.
 */
const getUTCDateOnly = (date = new Date()) => {
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    }
  }
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const formatUTCDateOnly = (date) => {
  const d = getUTCDateOnly(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * IST wall-clock datetime for API responses (no Z / no offset).
 * Example: punch 10:29 AM IST → "2026-07-23T10:29:50"
 *
 * Intentionally timezone-naive so frontends that format with utc() still
 * show the IST clock numbers instead of shifting back to 04:59 UTC.
 * All HRMS API datetimes are IST wall time.
 */
const formatDateTimeIST = (date) => {
  if (!date) return null;
  const p = getISTParts(date);
  const y = String(p.year);
  const m = String(p.month).padStart(2, '0');
  const d = String(p.day).padStart(2, '0');
  const h = String(p.hour).padStart(2, '0');
  const min = String(p.minute).padStart(2, '0');
  const s = String(p.second).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
};

/** 12-hour clock string in IST, e.g. "10:12 AM". */
const formatTimeIST = (date) => {
  if (!date) return null;
  const p = getISTParts(date);
  return minutesToTimeString(p.hour * 60 + p.minute);
};

const combineDateAndMinutes = (date, minutesFromMidnight) => {
  const d = getDateOnly(date);
  return new Date(d.getTime() + Number(minutesFromMidnight) * 60000);
};

const diffMinutes = (start, end) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
};

/** Minutes from IST midnight for the IST calendar day of `date`. */
const getMinutesFromDate = (date) => {
  const p = getISTParts(date);
  return p.hour * 60 + p.minute;
};

/** Sunday=0 … Saturday=6 in IST. */
const getDayOfWeek = (date = new Date()) => getISTParts(date).weekday;

const isWithinWindow = (timeMinutes, windowStart, windowEnd) =>
  timeMinutes >= windowStart && timeMinutes <= windowEnd;

const getMonthYear = (date = new Date()) => {
  const p = getISTParts(date);
  return { year: p.year, month: p.month };
};

/**
 * Inclusive IST month start + exclusive next-month start (for Mongo `$gte` / `$lt`).
 * month is 1–12.
 */
const getMonthRangeIST = (year, month) => {
  const y = Number(year);
  const m = Number(month);
  const start = new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET_MS);
  const endExclusive = new Date(Date.UTC(y, m, 1) - IST_OFFSET_MS);
  return { start, endExclusive };
};

const addDays = (date, days) => {
  const d = new Date(getDateOnly(date).getTime() + Number(days) * 86400000);
  return getDateOnly(d);
};

const eachDayInRange = (startDate, endDate) => {
  const days = [];
  let current = getDateOnly(startDate);
  const end = getDateOnly(endDate);
  while (current <= end) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  return days;
};

const countDaysInclusive = (startDate, endDate) => eachDayInRange(startDate, endDate).length;

const getQuarter = (date = new Date()) => Math.ceil(getISTParts(date).month / 3);

const getHalfYear = (date = new Date()) => (getISTParts(date).month < 6 ? 1 : 2);

const isSameDay = (a, b) => getDateOnly(a).getTime() === getDateOnly(b).getTime();

const datesOverlap = (start1, end1, start2, end2) =>
  getDateOnly(start1) <= getDateOnly(end2) && getDateOnly(start2) <= getDateOnly(end1);

module.exports = {
  APP_TIMEZONE,
  DAYS,
  DAY_NAME_TO_INDEX,
  getISTParts,
  parseTimeToMinutes,
  minutesToTimeString,
  getDateOnly,
  formatDateOnly,
  getUTCDateOnly,
  formatUTCDateOnly,
  formatDateTimeIST,
  formatTimeIST,
  combineDateAndMinutes,
  diffMinutes,
  getMinutesFromDate,
  getDayOfWeek,
  isWithinWindow,
  getMonthYear,
  getMonthRangeIST,
  addDays,
  eachDayInRange,
  countDaysInclusive,
  getQuarter,
  getHalfYear,
  isSameDay,
  datesOverlap,
};
