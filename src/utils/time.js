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
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
};

const getDateOnly = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** YYYY-MM-DD in local calendar (avoids UTC off-by-one from toISOString). */
const formatDateOnly = (date) => {
  const d = getDateOnly(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const combineDateAndMinutes = (date, minutesFromMidnight) => {
  const d = getDateOnly(date);
  d.setMinutes(minutesFromMidnight);
  return d;
};

const diffMinutes = (start, end) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
};

const getMinutesFromDate = (date) => {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
};

const isWithinWindow = (timeMinutes, windowStart, windowEnd) =>
  timeMinutes >= windowStart && timeMinutes <= windowEnd;

const getMonthYear = (date = new Date()) => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
});

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
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

const getQuarter = (date = new Date()) => Math.ceil((date.getMonth() + 1) / 3);

const getHalfYear = (date = new Date()) => (date.getMonth() < 6 ? 1 : 2);

const isSameDay = (a, b) => getDateOnly(a).getTime() === getDateOnly(b).getTime();

const datesOverlap = (start1, end1, start2, end2) =>
  getDateOnly(start1) <= getDateOnly(end2) && getDateOnly(start2) <= getDateOnly(end1);

module.exports = {
  DAYS,
  DAY_NAME_TO_INDEX,
  parseTimeToMinutes,
  minutesToTimeString,
  getDateOnly,
  formatDateOnly,
  combineDateAndMinutes,
  diffMinutes,
  getMinutesFromDate,
  isWithinWindow,
  getMonthYear,
  addDays,
  eachDayInRange,
  countDaysInclusive,
  getQuarter,
  getHalfYear,
  isSameDay,
  datesOverlap,
};
