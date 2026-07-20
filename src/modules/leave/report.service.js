const leaveRequestRepository = require('./leaveRequest.repository');
const leaveBalanceRepository = require('./leaveBalance.repository');
const { getDateOnly } = require('../../utils/time');

const generateReport = async (type, companyId, query) => {
  const filter = { companyId };
  if (query.departmentId) filter.departmentId = query.departmentId;
  if (query.leaveTypeCode) filter.leaveTypeCode = query.leaveTypeCode.toUpperCase();
  if (query.status) filter.status = query.status;

  const now = new Date();
  let startDate;
  let endDate = getDateOnly(now);

  switch (type) {
    case 'balance':
      return {
        type,
        data: (await leaveBalanceRepository.findByCompany(companyId, query)).map((b) => ({
          employeeId: b.employeeProfileId?.employeeId,
          employeeName: b.userId?.fullName,
          leaveType: b.leaveType,
          leaveTypeCode: b.leaveTypeCode,
          balance: b.balance,
        })),
      };

    case 'monthly': {
      const year = parseInt(query.year, 10) || now.getFullYear();
      const month = parseInt(query.month, 10) || now.getMonth() + 1;
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
      break;
    }
    case 'quarterly': {
      const year = parseInt(query.year, 10) || now.getFullYear();
      const quarter = parseInt(query.quarter, 10) || Math.ceil((now.getMonth() + 1) / 3);
      startDate = new Date(year, (quarter - 1) * 3, 1);
      endDate = new Date(year, quarter * 3, 0);
      break;
    }
    case 'short_leave':
      filter.leaveTypeCode = 'SL';
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    default:
      if (query.startDate) startDate = new Date(query.startDate);
      if (query.endDate) endDate = new Date(query.endDate);
  }

  if (startDate) {
    filter.startDate = { $gte: getDateOnly(startDate) };
    filter.endDate = { $lte: getDateOnly(endDate) };
  }

  if (type === 'summary' || type === 'company' || type === 'department' || type === 'monthly' || type === 'quarterly' || type === 'short_leave') {
    const leaves = await leaveRequestRepository.findByDateRange(companyId, startDate || new Date(0), endDate, filter);
    return {
      type,
      data: leaves.map((l) => ({
        id: l._id,
        employeeId: l.employeeProfileId?.employeeId,
        employeeName: l.userId?.fullName,
        departmentId: l.departmentId,
        leaveType: l.leaveType,
        leaveTypeCode: l.leaveTypeCode,
        startDate: l.startDate,
        endDate: l.endDate,
        totalDays: l.totalDays,
        status: l.status,
        appliedOn: l.appliedOn,
      })),
      period: { startDate, endDate },
    };
  }

  const result = await leaveRequestRepository.findWithFilters(filter, query, { companyId });
  return {
    type,
    data: result.data.map((l) => ({
      id: l._id,
      employeeId: l.employeeProfileId?.employeeId,
      employeeName: l.userId?.fullName,
      leaveTypeCode: l.leaveTypeCode,
      startDate: l.startDate,
      endDate: l.endDate,
      totalDays: l.totalDays,
      status: l.status,
    })),
    meta: result.meta,
  };
};

const getMonthlySummary = async (companyId, year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  const leaves = await leaveRequestRepository.findByDateRange(companyId, startDate, endDate);

  const summary = {};
  for (const l of leaves) {
    const key = l.leaveTypeCode;
    if (!summary[key]) summary[key] = { approved: 0, pending: 0, rejected: 0, totalDays: 0 };
    summary[key][l.status] = (summary[key][l.status] || 0) + 1;
    if (l.status === 'approved') summary[key].totalDays += l.totalDays;
  }

  return { year, month, summary, totalRequests: leaves.length };
};

module.exports = { generateReport, getMonthlySummary };
