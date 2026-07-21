const AttendanceRecord = require('./attendanceRecord.model');
const EmployeeProfile = require('../employees/employeeProfile.model');
const { getDateOnly, getMonthYear } = require('../../utils/time');
const workingHoursEngine = require('./engines/workingHours.engine');
const geofenceEngine = require('./engines/geofence.engine');
const locationEngine = require('./engines/location.engine');
const attendanceService = require('./attendance.service');

const getEmployeeDashboard = async (userId, companyId) => {
  const profile = await EmployeeProfile.findOne({ userId, companyId, isDeleted: false });
  const today = await attendanceService.getTodayAttendance(userId, companyId);
  const { year, month } = getMonthYear();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const monthlyRecords = await AttendanceRecord.find(
    {
      companyId,
      employeeProfileId: profile?._id,
      date: { $gte: monthStart, $lte: monthEnd },
    },
    null,
    { companyId }
  );

  const summary = {
    present: 0,
    late: 0,
    regularized: 0,
    half_day: 0,
    absent: 0,
    total: monthlyRecords.length,
  };

  monthlyRecords.forEach((r) => {
    if (summary[r.attendanceStatus] !== undefined) summary[r.attendanceStatus]++;
  });

  return { today, monthlySummary: summary };
};

const getManagerDashboard = async (managerUserId, companyId) => {
  const teamProfiles = await EmployeeProfile.find({ companyId, managerId: managerUserId, isDeleted: false });
  const teamUserIds = teamProfiles.map((p) => p.userId);
  const today = getDateOnly();

  const records = await AttendanceRecord.find(
    { companyId, userId: { $in: teamUserIds }, date: today },
    null,
    { companyId }
  )
    .populate('userId', 'firstName lastName fullName email')
    .populate({
      path: 'employeeProfileId',
      select: 'employeeId departmentId',
      populate: { path: 'departmentId', select: 'name' },
    });

  const summary = { present: 0, absent: 0, late: 0, half_day: 0, pendingPunchOut: 0, total: teamUserIds.length };

  records.forEach((r) => {
    if (['present', 'regularized'].includes(r.attendanceStatus)) summary.present++;
    if (r.attendanceStatus === 'late') summary.late++;
    if (r.attendanceStatus === 'half_day') summary.half_day++;
    if (r.attendanceStatus === 'absent') summary.absent++;
    if (workingHoursEngine.hasOpenSession(r)) summary.pendingPunchOut++;
  });

  summary.absent += Math.max(0, teamUserIds.length - records.length);

  const formattedRecords = records.map((r) => attendanceService.formatRecord(r));

  return { summary, records: formattedRecords };
};

const getManagerLiveDashboard = async (managerUserId, companyId) => {
  const profileFilter = { companyId, isDeleted: false, status: 'active' };
  if (managerUserId) {
    profileFilter.managerId = managerUserId;
  }

  const teamProfiles = await EmployeeProfile.find(profileFilter)
    .populate('userId', 'firstName lastName fullName email')
    .populate('departmentId', 'name');

  const today = getDateOnly();
  const teamUserIds = teamProfiles.map((p) => p.userId?._id || p.userId);

  const records = await AttendanceRecord.find(
    { companyId, userId: { $in: teamUserIds }, date: today },
    null,
    { companyId }
  );

  const recordByUserId = new Map(records.map((r) => [String(r.userId), r]));

  const team = await Promise.all(
    teamProfiles.map(async (profile) => {
      const userId = profile.userId?._id || profile.userId;
      const record = recordByUserId.get(String(userId));
      const hasOpenSession = record ? workingHoursEngine.hasOpenSession(record) : false;
      const lastKnownLocation = locationEngine.resolveDisplayLocation(record);

      let geofenceStatus = null;
      if (lastKnownLocation?.latitude != null && lastKnownLocation?.longitude != null) {
        const evaluation = await geofenceEngine.evaluateLocation(
          companyId,
          lastKnownLocation.latitude,
          lastKnownLocation.longitude
        );
        geofenceStatus = {
          inside: evaluation.allowed,
          distanceMeters: evaluation.distanceMeters,
          matchedOffice: evaluation.matchedOffice,
          nearestOffice: evaluation.nearestOffice,
        };
      }

      return {
        employeeProfileId: profile._id,
        employeeId: profile.employeeId,
        userId,
        name: profile.userId?.fullName || null,
        email: profile.userId?.email || null,
        department: profile.departmentId?.name || null,
        attendanceStatus: record?.attendanceStatus || 'absent',
        punchedIn: hasOpenSession,
        hasOpenSession,
        punchIn: record?.punchIn || null,
        punchOut: hasOpenSession ? null : record?.punchOut || null,
        lastKnownLocation,
        geofenceStatus,
      };
    })
  );

  const summary = {
    total: team.length,
    punchedIn: team.filter((t) => t.hasOpenSession).length,
    withLocation: team.filter((t) => t.lastKnownLocation).length,
    insideGeofence: team.filter((t) => t.geofenceStatus?.inside).length,
    outsideGeofence: team.filter((t) => t.geofenceStatus && !t.geofenceStatus.inside).length,
  };

  return { summary, team, asOf: new Date() };
};

const getHrDashboard = async (companyId) => {
  const today = getDateOnly();
  const records = await AttendanceRecord.find({ companyId, date: today }, null, { companyId })
    .populate('userId', 'firstName lastName fullName email')
    .populate({
      path: 'employeeProfileId',
      select: 'employeeId departmentId',
      populate: { path: 'departmentId', select: 'name' },
    });

  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    half_day: 0,
    regularized: 0,
    missingPunch: 0,
    total: records.length,
  };

  const lateEmployees = [];
  const missingPunch = [];

  records.forEach((r) => {
    if (summary[r.attendanceStatus] !== undefined) summary[r.attendanceStatus]++;
    if (r.attendanceStatus === 'late') lateEmployees.push(r);
    if (r.attendanceStatus === 'missing_punch') missingPunch.push(r);
  });

  const formattedRecords = records.map((r) => attendanceService.formatRecord(r));

  return {
    summary,
    lateEmployees: lateEmployees.map((r) => attendanceService.formatRecord(r)),
    missingPunch: missingPunch.map((r) => attendanceService.formatRecord(r)),
    records: formattedRecords,
  };
};

module.exports = {
  getEmployeeDashboard,
  getManagerDashboard,
  getManagerLiveDashboard,
  getHrDashboard,
};
