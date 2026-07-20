const AttendanceRecord = require('../../attendance/attendanceRecord.model');
const { getDateOnly, eachDayInRange } = require('../../../utils/time');

const applyLeaveToAttendance = async (leaveRequest) => {
  const { companyId, employeeProfileId, userId, startDate, endDate, isHalfDay, _id, leaveType, leaveTypeCode } =
    leaveRequest;

  // Balance-only leave entries (no dates) do not mark attendance days
  if (!startDate || !endDate) return [];

  const days = eachDayInRange(startDate, endDate);
  const results = [];

  for (const day of days) {
    const date = getDateOnly(day);
    const attendanceStatus = isHalfDay && days.length === 1 ? 'half_day' : 'leave';

    const existing = await AttendanceRecord.findOne({ companyId, employeeProfileId, date }, null, { companyId });

    if (existing) {
      const updated = await AttendanceRecord.findByIdAndUpdate(
        existing._id,
        {
          attendanceStatus,
          remarks: `Leave: ${leaveTypeCode} (${leaveType})`,
          updatedBy: userId,
        },
        { new: true }
      );
      results.push(updated);
    } else {
      const created = await AttendanceRecord.create({
        companyId,
        employeeProfileId,
        userId,
        date,
        attendanceStatus,
        remarks: `Leave: ${leaveTypeCode} (${leaveType}) - Ref: ${_id}`,
        createdBy: userId,
        updatedBy: userId,
      });
      results.push(created);
    }
  }

  return results;
};

const revertLeaveFromAttendance = async (leaveRequest) => {
  const { companyId, employeeProfileId, startDate, endDate } = leaveRequest;
  if (!startDate || !endDate) return;

  const days = eachDayInRange(startDate, endDate);

  for (const day of days) {
    const date = getDateOnly(day);
    const existing = await AttendanceRecord.findOne(
      { companyId, employeeProfileId, date, attendanceStatus: { $in: ['leave', 'half_day', 'on_leave'] } },
      null,
      { companyId }
    );

    if (existing && !existing.punchIn?.timestamp) {
      await AttendanceRecord.findByIdAndUpdate(existing._id, {
        attendanceStatus: 'absent',
        remarks: 'Leave cancelled',
      });
    } else if (existing) {
      await AttendanceRecord.findByIdAndUpdate(existing._id, {
        remarks: 'Leave cancelled — attendance retained',
      });
    }
  }
};

module.exports = { applyLeaveToAttendance, revertLeaveFromAttendance };
