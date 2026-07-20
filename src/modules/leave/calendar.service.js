const leaveRequestRepository = require('./leaveRequest.repository');
const { getDateOnly } = require('../../utils/time');

const getCalendar = async (companyId, year, month, options = {}) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const leaves = await leaveRequestRepository.findByDateRange(companyId, startDate, endDate, {
    status: 'approved',
  });

  const scopedUserIds =
    options.userIds?.length > 0
      ? options.userIds
      : options.teamUserIds?.length > 0
        ? options.teamUserIds
        : null;

  const scopedUserIdSet = scopedUserIds
    ? new Set(scopedUserIds.map((id) => id.toString()))
    : null;

  const filtered = scopedUserIdSet
    ? leaves.filter((l) => {
        const userId = l.userId?._id || l.userId;
        return userId && scopedUserIdSet.has(userId.toString());
      })
    : leaves;

  const events = filtered.map((l) => ({
    id: l._id,
    title: `${l.leaveTypeCode} - ${l.userId?.fullName || 'Employee'}`,
    leaveType: l.leaveType,
    leaveTypeCode: l.leaveTypeCode,
    employeeProfileId: l.employeeProfileId?._id || l.employeeProfileId,
    userId: l.userId?._id || l.userId,
    startDate: getDateOnly(l.startDate),
    endDate: getDateOnly(l.endDate),
    totalDays: l.totalDays,
    isHalfDay: l.isHalfDay,
    halfDaySession: l.halfDaySession,
    status: l.status,
  }));

  return { year, month, events };
};

module.exports = { getCalendar };
