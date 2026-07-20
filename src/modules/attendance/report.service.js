const AttendanceRecord = require('./attendanceRecord.model');
const { getDateOnly } = require('../../utils/time');
const attendanceService = require('./attendance.service');

const buildDateRange = (type, query) => {
  const now = new Date();
  let dateFrom;
  let dateTo = getDateOnly(now);

  if (type === 'daily') {
    dateFrom = query.date ? getDateOnly(new Date(query.date)) : dateTo;
    dateTo = dateFrom;
  } else if (type === 'weekly') {
    dateFrom = new Date(dateTo);
    dateFrom.setDate(dateFrom.getDate() - 7);
  } else if (type === 'monthly') {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else {
    dateFrom = query.dateFrom ? getDateOnly(new Date(query.dateFrom)) : dateFrom;
    dateTo = query.dateTo ? getDateOnly(new Date(query.dateTo)) : dateTo;
  }

  return { dateFrom, dateTo };
};

const generateReport = async (type, companyId, query) => {
  const { dateFrom, dateTo } = buildDateRange(type, query);
  const filter = {
    companyId,
    date: { $gte: dateFrom, $lte: dateTo },
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
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const records = await AttendanceRecord.find(
    { companyId, employeeProfileId: profile._id, date: { $gte: monthStart, $lte: monthEnd } },
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
