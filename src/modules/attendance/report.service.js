const AttendanceRecord = require('./attendanceRecord.model');
const { getDateOnly, getMonthRangeIST, getMonthYear, addDays } = require('../../utils/time');
const attendanceService = require('./attendance.service');
const attendanceRepository = require('./attendance.repository');

const buildDateRange = (type, query) => {
  const now = new Date();
  let dateFrom;
  let dateTo = getDateOnly(now);
  let endExclusive = null;

  if (type === 'daily') {
    dateFrom = query.date ? getDateOnly(new Date(query.date)) : dateTo;
    dateTo = dateFrom;
  } else if (type === 'weekly') {
    dateFrom = addDays(dateTo, -7);
  } else if (type === 'monthly') {
    const { year, month } = getMonthYear(now);
    const range = getMonthRangeIST(year, month);
    dateFrom = range.start;
    dateTo = addDays(range.endExclusive, -1);
    endExclusive = range.endExclusive;
  } else {
    dateFrom = query.dateFrom ? getDateOnly(new Date(query.dateFrom)) : dateFrom;
    dateTo = query.dateTo ? getDateOnly(new Date(query.dateTo)) : dateTo;
  }

  return { dateFrom, dateTo, endExclusive };
};

const generateReport = async (type, companyId, query) => {
  const { dateFrom, dateTo, endExclusive } = buildDateRange(type, query);
  const filter = {
    companyId,
    date: endExclusive
      ? { $gte: dateFrom, $lt: endExclusive }
      : dateFrom && dateTo && dateFrom.getTime() === dateTo.getTime()
        ? attendanceRepository.istDayFilter(dateFrom)
        : { $gte: dateFrom, $lt: addDays(dateTo, 1) },
  };

  if (query.departmentId) {
    const profiles = await require('../employees/employeeProfile.model').find({
      companyId,
      departmentId: query.departmentId,
    }).select('_id');
    filter.employeeProfileId = { $in: profiles.map((p) => p._id) };
  }
  if (query.shiftId) filter.shiftId = query.shiftId;
  if (query.status) filter.attendanceStatus = query.status;
  if (query.userId) filter.userId = query.userId;

  const records = await AttendanceRecord.find(filter, null, { companyId })
    .populate('userId', 'firstName lastName fullName email')
    .populate('employeeProfileId', 'employeeId departmentId')
    .populate('shiftId', 'name code')
    .sort({ date: -1 });

  const statusSummary = {};
  records.forEach((r) => {
    statusSummary[r.attendanceStatus] = (statusSummary[r.attendanceStatus] || 0) + 1;
  });

  return {
    type,
    dateFrom,
    dateTo,
    totalRecords: records.length,
    statusSummary,
    data: records.map(attendanceService.formatRecord),
  };
};

const getMonthlySummary = async (companyId, userId, year, month) => {
  const profile = await require('./attendance.helper').getEmployeeProfileByUser(userId, companyId);
  const { start: monthStart, endExclusive: monthEndExclusive } = getMonthRangeIST(year, month);

  const records = await AttendanceRecord.find(
    {
      companyId,
      employeeProfileId: profile._id,
      date: { $gte: monthStart, $lt: monthEndExclusive },
    },
    null,
    { companyId }
  );

  const summary = { present: 0, late: 0, regularized: 0, half_day: 0, absent: 0, total: records.length };
  let totalNetMinutes = 0;

  records.forEach((r) => {
    if (summary[r.attendanceStatus] !== undefined) summary[r.attendanceStatus]++;
    totalNetMinutes += r.netWorkingMinutes || 0;
  });

  return { year, month, summary, totalNetMinutes, records: records.map(attendanceService.formatRecord) };
};

module.exports = { generateReport, getMonthlySummary };
