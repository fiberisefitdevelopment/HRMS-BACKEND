const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { getDateOnly, addDays, formatDateTimeIST } = require('../../utils/time');
const employeeRepository = require('../employees/employee.repository');
const employeeService = require('../employees/employee.service');
const User = require('../users/user.model');
const EmployeeProfile = require('../employees/employeeProfile.model');
const AttendanceRecord = require('../attendance/attendanceRecord.model');
const LeaveRequest = require('../leave/leaveRequest.model');
const CompOffRequest = require('../comp-off/compOffRequest.model');
const LeaveBalance = require('../leave/leaveBalance.model');
const musterRollService = require('../attendance/musterRoll.service');
const workingHoursEngine = require('../attendance/engines/workingHours.engine');
const locationEngine = require('../attendance/engines/location.engine');
const geofenceEngine = require('../attendance/engines/geofence.engine');
const { SYSTEM_ROLES } = require('../../constants');

const findManagerInCompany = async (managerUserId, companyId) => {
  const manager = await User.findById(managerUserId);
  if (!manager) throw ApiError.notFound('Manager not found');

  const companyKey = companyId.toString();
  const hasAccess =
    manager.companyId?.toString() === companyKey ||
    (manager.accessibleCompanyIds || []).some((id) => id.toString() === companyKey);

  if (!hasAccess) throw ApiError.notFound('Manager not found');
  return manager;
};

const assertManagerAccess = (managerUserId, requester) => {
  if (
    requester.roleSlug === SYSTEM_ROLES.MANAGER &&
    requester.id.toString() !== managerUserId.toString()
  ) {
    throw ApiError.forbidden('Managers can only view their own team');
  }
};

const formatLeaveSummary = (leave) =>
  leave
    ? {
        id: leave._id,
        leaveTypeCode: leave.leaveTypeCode,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        totalDays: leave.totalDays,
        status: leave.status,
        reason: leave.reason,
        appliedOn: leave.appliedOn,
      }
    : null;

const formatCompOffSummary = (req) =>
  req
    ? {
        id: req._id,
        attendanceDate: req.attendanceDate,
        requestedDays: req.requestedDays,
        eligibilityType: req.eligibilityType,
        status: req.status,
        reason: req.reason,
      }
    : null;

const getTeamOverview = async (managerUserId, companyId, requester) => {
  assertManagerAccess(managerUserId, requester);

  const manager = await findManagerInCompany(managerUserId, companyId);

  const teamProfiles = await EmployeeProfile.find({
    companyId,
    managerId: managerUserId,
    isDeleted: false,
    status: 'active',
  })
    .populate('userId', 'firstName lastName fullName email')
    .populate('departmentId', 'name')
    .populate('designationId', 'name')
    .sort({ employeeId: 1 });

  const today = getDateOnly();
  const tomorrow = addDays(today, 1);
  const profileIds = teamProfiles.map((p) => p._id);
  const userIds = teamProfiles.map((p) => p.userId?._id || p.userId);

  const [records, balances, pendingLeaves, pendingCompOffs, todayLeaves] = await Promise.all([
    AttendanceRecord.find(
      { companyId, userId: { $in: userIds }, date: { $gte: today, $lt: tomorrow } },
      null,
      { companyId }
    ),
    LeaveBalance.find({ companyId, employeeProfileId: { $in: profileIds } }, null, { companyId }),
    LeaveRequest.find({ companyId, managerId: managerUserId, status: 'pending' }, null, { companyId })
      .select('employeeProfileId userId leaveTypeCode startDate endDate totalDays reason appliedOn status')
      .sort({ appliedOn: -1 }),
    CompOffRequest.find({ companyId, managerId: managerUserId, status: 'pending' }, null, { companyId })
      .select('employeeProfileId userId attendanceDate requestedDays eligibilityType reason status')
      .sort({ createdAt: -1 }),
    LeaveRequest.find(
      {
        companyId,
        employeeProfileId: { $in: profileIds },
        status: { $in: ['pending', 'approved'] },
        startDate: { $lte: today },
        endDate: { $gte: today },
      },
      null,
      { companyId }
    ).select('employeeProfileId leaveTypeCode startDate endDate status totalDays reason'),
  ]);

  const recordByUserId = new Map(records.map((r) => [String(r.userId), r]));
  const balancesByProfile = new Map();
  balances.forEach((b) => {
    const key = String(b.employeeProfileId);
    if (!balancesByProfile.has(key)) balancesByProfile.set(key, []);
    balancesByProfile.get(key).push({
      leaveTypeCode: b.leaveTypeCode,
      leaveType: b.leaveType,
      balance: b.balance,
    });
  });

  const pendingLeaveByProfile = new Map();
  pendingLeaves.forEach((leave) => {
    const key = String(leave.employeeProfileId);
    if (!pendingLeaveByProfile.has(key)) pendingLeaveByProfile.set(key, []);
    pendingLeaveByProfile.get(key).push(leave);
  });

  const pendingCompOffByProfile = new Map();
  pendingCompOffs.forEach((req) => {
    const key = String(req.employeeProfileId);
    if (!pendingCompOffByProfile.has(key)) pendingCompOffByProfile.set(key, []);
    pendingCompOffByProfile.get(key).push(req);
  });

  const todayLeaveByProfile = new Map();
  todayLeaves.forEach((leave) => {
    todayLeaveByProfile.set(String(leave.employeeProfileId), leave);
  });

  const summary = {
    total: teamProfiles.length,
    present: 0,
    late: 0,
    halfDay: 0,
    absent: 0,
    onLeave: 0,
    pendingLeave: 0,
    weekOff: 0,
    punchedIn: 0,
    pendingLeaveApprovals: pendingLeaves.length,
    pendingCompOffApprovals: pendingCompOffs.length,
  };

  const members = await Promise.all(
    teamProfiles.map(async (profile) => {
      const profileKey = String(profile._id);
      const userId = profile.userId?._id || profile.userId;
      const record = recordByUserId.get(String(userId));
      const hasOpenSession = record ? workingHoursEngine.hasOpenSession(record) : false;
      const firstPunchIn = record ? workingHoursEngine.getFirstPunchIn(record) : null;
      const todayLeave = todayLeaveByProfile.get(profileKey);
      const attendanceStatus = record?.attendanceStatus || 'absent';

      if (todayLeave && !firstPunchIn?.timestamp) summary.onLeave += 1;
      else if (['present', 'regularized'].includes(attendanceStatus)) summary.present += 1;
      else if (attendanceStatus === 'late') summary.late += 1;
      else if (attendanceStatus === 'half_day') summary.halfDay += 1;
      else if (attendanceStatus === 'week_off') summary.weekOff += 1;
      else summary.absent += 1;

      if (hasOpenSession) summary.punchedIn += 1;
      if (todayLeave?.status === 'pending') summary.pendingLeave += 1;

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

      const memberPendingLeaves = pendingLeaveByProfile.get(profileKey) || [];
      const memberPendingCompOffs = pendingCompOffByProfile.get(profileKey) || [];

      return {
        employeeProfileId: profile._id,
        employeeId: profile.employeeId,
        userId,
        name:
          profile.userId?.fullName ||
          `${profile.userId?.firstName || ''} ${profile.userId?.lastName || ''}`.trim() ||
          profile.employeeId,
        email: profile.userId?.email || null,
        department: profile.departmentId?.name || null,
        designation: profile.designationId?.name || null,
        leaveBalances: balancesByProfile.get(profileKey) || [],
        todayAttendance: {
          status: todayLeave && !firstPunchIn?.timestamp ? 'on_leave' : attendanceStatus,
          punchedIn: hasOpenSession,
          hasOpenSession,
          lateByMinutes: record?.lateByMinutes || 0,
          punchIn: firstPunchIn || null,
          punchOut: record
            ? hasOpenSession
              ? null
              : workingHoursEngine.getLastPunchOut(record) || null
            : null,
          lastKnownLocation: lastKnownLocation
            ? {
                ...lastKnownLocation,
                recordedAt: lastKnownLocation.recordedAt
                  ? formatDateTimeIST(lastKnownLocation.recordedAt)
                  : null,
              }
            : null,
          geofenceStatus,
        },
        todayLeave: formatLeaveSummary(todayLeave),
        // Combined pending leave + raised pending comp-off for this member.
        pendingLeaveCount: memberPendingLeaves.length + memberPendingCompOffs.length,
        pendingLeaves: memberPendingLeaves.map(formatLeaveSummary),
        pendingCompOffCount: memberPendingCompOffs.length,
        pendingCompOffs: memberPendingCompOffs.map(formatCompOffSummary),
      };
    })
  );

  return {
    manager: {
      id: manager._id,
      firstName: manager.firstName,
      lastName: manager.lastName,
      fullName: manager.fullName,
      email: manager.email,
    },
    summary,
    members,
    asOf: new Date(),
  };
};

const getTeamAttendance = async (managerUserId, companyId, query, requester) => {
  assertManagerAccess(managerUserId, requester);

  const manager = await findManagerInCompany(managerUserId, companyId);

  const muster = await musterRollService.getMusterRoll(companyId, {
    ...query,
    managerId: managerUserId,
  });

  return {
    manager: {
      id: manager._id,
      firstName: manager.firstName,
      lastName: manager.lastName,
      fullName: manager.fullName,
      email: manager.email,
    },
    ...muster,
    asOf: new Date(),
  };
};

const assignManager = async (employeeProfileId, managerId, companyId, actorId, req) => {
  const profile = await employeeRepository.findByIdWithDetails(employeeProfileId, companyId);
  if (!profile) throw ApiError.notFound('Employee not found');

  let resolvedManagerId = null;
  if (managerId) {
    resolvedManagerId = await employeeService.validateManager(managerId, companyId);
    if (resolvedManagerId.toString() === profile.userId._id.toString()) {
      throw ApiError.badRequest('Employee cannot be their own manager');
    }
  }

  const previousManagerId = profile.managerId?._id;
  await employeeRepository.updateById(
    employeeProfileId,
    { managerId: resolvedManagerId, updatedBy: actorId },
    { companyId }
  );
  await User.findByIdAndUpdate(profile.userId._id, { managerId: resolvedManagerId });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'employee',
    entityId: employeeProfileId,
    changes: { before: { managerId: previousManagerId }, after: { managerId: resolvedManagerId } },
    metadata: { action: 'manager_assigned' },
    req,
  });

  return employeeService.getEmployee(employeeProfileId, companyId);
};

const removeManager = async (employeeProfileId, companyId, actorId, req) =>
  assignManager(employeeProfileId, null, companyId, actorId, req);

const getTeamMembers = async (managerUserId, companyId, query, requester) => {
  assertManagerAccess(managerUserId, requester);

  const manager = await findManagerInCompany(managerUserId, companyId);

  const result = await employeeRepository.findTeamByManager(managerUserId, companyId, query);
  const profiles = result.data || [];
  const profileIds = profiles.map((p) => p._id);
  const userIds = profiles.map((p) => p.userId?._id || p.userId).filter(Boolean);

  const today = getDateOnly();
  const tomorrow = addDays(today, 1);

  const [records, todayLeaves, pendingLeaves, pendingCompOffs] = await Promise.all([
    userIds.length
      ? AttendanceRecord.find(
          { companyId, userId: { $in: userIds }, date: { $gte: today, $lt: tomorrow } },
          null,
          { companyId }
        )
      : [],
    profileIds.length
      ? LeaveRequest.find(
          {
            companyId,
            employeeProfileId: { $in: profileIds },
            status: { $in: ['pending', 'approved'] },
            startDate: { $lte: today },
            endDate: { $gte: today },
          },
          null,
          { companyId }
        ).select('employeeProfileId leaveTypeCode leaveType startDate endDate status totalDays reason')
      : [],
    profileIds.length
      ? LeaveRequest.find(
          {
            companyId,
            employeeProfileId: { $in: profileIds },
            status: 'pending',
          },
          null,
          { companyId }
        ).select('employeeProfileId')
      : [],
    profileIds.length
      ? CompOffRequest.find(
          {
            companyId,
            employeeProfileId: { $in: profileIds },
            status: 'pending',
          },
          null,
          { companyId }
        ).select('employeeProfileId attendanceDate requestedDays eligibilityType reason status')
      : [],
  ]);

  const recordByUserId = new Map(records.map((r) => [String(r.userId), r]));
  const leaveByProfileId = new Map(
    todayLeaves.map((leave) => [String(leave.employeeProfileId), leave])
  );
  const pendingLeaveCountByProfile = new Map();
  pendingLeaves.forEach((leave) => {
    const key = String(leave.employeeProfileId);
    pendingLeaveCountByProfile.set(key, (pendingLeaveCountByProfile.get(key) || 0) + 1);
  });
  const pendingCompOffCountByProfile = new Map();
  pendingCompOffs.forEach((req) => {
    const key = String(req.employeeProfileId);
    pendingCompOffCountByProfile.set(key, (pendingCompOffCountByProfile.get(key) || 0) + 1);
  });

  const data = profiles.map((profile) => {
    const formatted = employeeService.formatEmployee(profile);
    const userId = profile.userId?._id || profile.userId;
    const record = recordByUserId.get(String(userId));
    const todayLeave = leaveByProfileId.get(String(profile._id));
    const hasOpenSession = record ? workingHoursEngine.hasOpenSession(record) : false;
    const firstPunchIn = record ? workingHoursEngine.getFirstPunchIn(record) : null;
    const attendanceStatus = record?.attendanceStatus || 'absent';
    const onLeave = Boolean(todayLeave && !firstPunchIn?.timestamp);
    const status = onLeave ? 'on_leave' : attendanceStatus;
    const profileKey = String(profile._id);
    const pendingLeaveOnly = pendingLeaveCountByProfile.get(profileKey) || 0;
    const pendingCompOffOnly = pendingCompOffCountByProfile.get(profileKey) || 0;

    return {
      ...formatted,
      todayAttendance: {
        status,
        punchedIn: hasOpenSession,
        hasOpenSession,
        lateByMinutes: record?.lateByMinutes || 0,
        punchIn: firstPunchIn || null,
        punchOut: record
          ? hasOpenSession
            ? null
            : workingHoursEngine.getLastPunchOut(record) || null
          : null,
      },
      todayLeave: formatLeaveSummary(todayLeave),
      // Includes pending leave + raised pending comp-off requests for this member.
      pendingLeaveCount: pendingLeaveOnly + pendingCompOffOnly,
      pendingCompOffCount: pendingCompOffOnly,
    };
  });

  return {
    manager: { id: manager._id, firstName: manager.firstName, lastName: manager.lastName, email: manager.email },
    data,
    meta: result.meta,
  };
};

module.exports = {
  assignManager,
  changeManager: assignManager,
  removeManager,
  getTeamMembers,
  getTeamOverview,
  getTeamAttendance,
};
