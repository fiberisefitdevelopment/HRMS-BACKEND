const Holiday = require('./holiday.model');
const { getDateOnly, formatDateOnly } = require('../../utils/time');

const formatHoliday = (doc) => {
  if (!doc) return null;
  return {
    id: doc._id,
    holidayName: doc.holidayName,
    holidayDate: doc.holidayDate ? formatDateOnly(doc.holidayDate) : null,
    description: doc.description || '',
    holidayCode: doc.holidayCode || null,
    location: doc.location || '',
    // Aliases used by calendar / dashboard cards
    name: doc.holidayName,
    date: doc.holidayDate ? formatDateOnly(doc.holidayDate) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const listHolidays = async (companyId, query = {}) => {
  const filter = { companyId, isActive: true };

  if (query.year) {
    const year = Number(query.year);
    filter.holidayDate = {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1),
    };
  }

  if (query.upcoming === 'true' || query.upcoming === true) {
    const today = getDateOnly();
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
