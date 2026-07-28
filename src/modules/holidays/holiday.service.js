const Holiday = require('./holiday.model');
const { getUTCDateOnly, formatUTCDateOnly } = require('../../utils/time');

// Holiday dates are pure calendar dates (no time-of-day). Always store/read
// them as UTC-anchored midnight so the displayed date never shifts based on
// the server process's local timezone (e.g. dev machine on IST vs. a
// production host on UTC).
const formatHoliday = (doc) => {
  if (!doc) return null;
  const dateStr = doc.holidayDate ? formatUTCDateOnly(doc.holidayDate) : null;
  return {
    id: doc._id,
    holidayName: doc.holidayName,
    holidayDate: dateStr,
    description: doc.description || '',
    holidayCode: doc.holidayCode || null,
    location: doc.location || '',
    // Aliases used by calendar / dashboard cards
    name: doc.holidayName,
    date: dateStr,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const listHolidays = async (companyId, query = {}) => {
  const filter = { companyId, isActive: true };

  if (query.year) {
    const year = Number(query.year);
    filter.holidayDate = {
      $gte: new Date(Date.UTC(year, 0, 1)),
      $lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  if (query.upcoming === 'true' || query.upcoming === true) {
    const today = getUTCDateOnly();
    filter.holidayDate = {
      ...(filter.holidayDate || {}),
      $gte: today,
    };
  }

  const holidays = await Holiday.find(filter, null, { companyId }).sort({ holidayDate: 1 });
  return holidays.map(formatHoliday);
};

module.exports = {
  listHolidays,
  formatHoliday,
};
