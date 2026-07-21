const User = require('../../modules/users/user.model');
const EmployeeProfile = require('../../modules/employees/employeeProfile.model');
const AttendanceRecord = require('../../modules/attendance/attendanceRecord.model');
const LeaveRequest = require('../../modules/leave/leaveRequest.model');
const CompOffRequest = require('../../modules/comp-off/compOffRequest.model');
const Company = require('../../modules/companies/company.model');
const { dbLogger } = require('../../config/logger');
const { getDateOnly } = require('../../utils/time');
const { OWNER_CODE } = require('./seedHrmsExcelData');

const TEST_MARKER = '[MANAGER_TEST_SEED]';

const addDays = (date, days) => {
  const d = getDateOnly(date);
  d.setDate(d.getDate() + days);
  return d;
};

const findLastSunday = (from = new Date()) => {
  const d = getDateOnly(from);
  d.setDate(d.getDate() - d.getDay());
  if (d >= getDateOnly(from)) d.setDate(d.getDate() - 7);
  return d;
};

const buildWeekendAttendance = ({ companyId, profile, userId, attendanceDate, actorId }) => {
  const punchInAt = new Date(attendanceDate);
  punchInAt.setHours(10, 0, 0, 0);
  const punchOutAt = new Date(attendanceDate);
  punchOutAt.setHours(19, 30, 0, 0);
  const shiftEndTime = new Date(attendanceDate);
  shiftEndTime.setHours(18, 30, 0, 0);

  const punchIn = {
    timestamp: punchInAt,
    source: 'web',
    latitude: 28.5355,
    longitude: 77.391,
    accuracyMeters: 20,
  };
  const punchOut = {
    timestamp: punchOutAt,
    source: 'web',
    latitude: 28.5355,
    longitude: 77.391,
    accuracyMeters: 20,
  };

  return {
    companyId,
    employeeProfileId: profile._id,
    userId,
    date: getDateOnly(attendanceDate),
    punchIn,
    punchOut,
    punchSessions: [{ punchIn, punchOut }],
    lastKnownLocation: {
      latitude: punchIn.latitude,
      longitude: punchIn.longitude,
      accuracyMeters: 20,
      recordedAt: punchInAt,
      source: 'punch',
    },
    grossWorkingMinutes: 570,
    netWorkingMinutes: 540,
    attendanceStatus: 'present',
    attendanceSource: 'web',
    remarks: TEST_MARKER,
    createdBy: actorId,
    updatedBy: actorId,
    shiftEndTime,
    punchOutAt,
    overtimeMinutes: 60,
  };
};

const seedManagerTestData = async () => {
  const owner = await User.findOne({ employeeCode: OWNER_CODE });
  if (!owner) {
    dbLogger.info('Owner not found — skipping manager test seed');
    return;
  }

  const company =
    (await Company.findOne({ companyCode: 'FIBERISE' })) ||
    (await Company.findById(owner.companyId));
  if (!company) {
    dbLogger.info('Company not found — skipping manager test seed');
    return;
  }

  const companyId = company._id;
  const managerId = owner._id;

  const existing = await LeaveRequest.findOne({ companyId, reason: TEST_MARKER });
  if (existing) {
    dbLogger.info('Manager test data already seeded — skipping');
    return;
  }

  const team = await EmployeeProfile.find({
    companyId,
    managerId,
    isDeleted: false,
    status: 'active',
  })
    .sort({ employeeId: 1 })
    .limit(6);

  if (team.length < 3) {
    dbLogger.warn('Not enough team members under manager for test seed', { count: team.length });
    return;
  }

  const today = getDateOnly();
  const weekendDate = findLastSunday(today);
  const leaveConfigs = [
    { status: 'pending', startOffset: 5, endOffset: 5, leaveTypeCode: 'CL', leaveType: 'casual_leave' },
    { status: 'approved', startOffset: 8, endOffset: 9, leaveTypeCode: 'CL', leaveType: 'casual_leave' },
    { status: 'rejected', startOffset: 12, endOffset: 12, leaveTypeCode: 'SL', leaveType: 'sick_leave' },
  ];

  for (let i = 0; i < 3; i += 1) {
    const profile = team[i];
    const userId = profile.userId;
    const cfg = leaveConfigs[i];
    const startDate = addDays(today, cfg.startOffset);
    const endDate = addDays(today, cfg.endOffset);

    await LeaveRequest.create({
      companyId,
      employeeProfileId: profile._id,
      userId,
      departmentId: profile.departmentId,
      managerId,
      leaveType: cfg.leaveType,
      leaveTypeCode: cfg.leaveTypeCode,
      startDate,
      endDate,
      totalDays: cfg.endOffset - cfg.startOffset + 1,
      isHalfDay: false,
      reason: TEST_MARKER,
      appliedOn: new Date(),
      source: 'self',
      status: cfg.status,
      currentApprovalStage: cfg.status === 'approved' ? 'approved' : 'manager',
      approvals: [
        {
          stage: 'manager',
          approverId: managerId,
          status: cfg.status === 'pending' ? 'pending' : cfg.status,
          comment: cfg.status === 'rejected' ? 'Test rejection' : null,
          actedAt: cfg.status === 'pending' ? null : new Date(),
        },
      ],
      approvedAt: cfg.status === 'approved' ? new Date() : null,
      rejectedReason: cfg.status === 'rejected' ? 'Test rejection for API' : null,
      createdBy: userId,
      updatedBy: managerId,
    });
  }

  const compOffStatuses = ['pending', 'approved', 'rejected'];
  for (let i = 0; i < 3; i += 1) {
    const profile = team[i + 3] || team[i];
    const userId = profile.userId;
    const attendanceDate = addDays(weekendDate, -i * 7);
    const attendancePayload = buildWeekendAttendance({
      companyId,
      profile,
      userId,
      attendanceDate,
      actorId: userId,
    });

    let record = await AttendanceRecord.findOne(
      { companyId, employeeProfileId: profile._id, date: attendancePayload.date },
      null,
      { companyId }
    );

    if (!record) {
      record = await AttendanceRecord.create(attendancePayload);
    }

    const status = compOffStatuses[i];
    await CompOffRequest.create({
      companyId,
      employeeProfileId: profile._id,
      userId,
      managerId,
      attendanceDate: attendancePayload.date,
      attendanceRecordId: record._id,
      shiftEndTime: attendancePayload.shiftEndTime,
      punchOutAt: attendancePayload.punchOutAt,
      overtimeMinutes: attendancePayload.overtimeMinutes,
      eligibilityType: 'weekly_off',
      requestedDays: 1,
      reason: TEST_MARKER,
      status,
      approvedBy: status === 'approved' ? managerId : null,
      approvedAt: status === 'approved' ? new Date() : null,
      approvedComment: status === 'approved' ? 'Test approval' : null,
      rejectedBy: status === 'rejected' ? managerId : null,
      rejectedReason: status === 'rejected' ? 'Test comp-off rejection' : null,
      createdBy: userId,
      updatedBy: managerId,
    });
  }

  dbLogger.info('Manager test data seeded', {
    managerId: managerId.toString(),
    pendingLeaves: 1,
    approvedLeaves: 1,
    rejectedLeaves: 1,
    pendingCompOffs: 1,
    approvedCompOffs: 1,
    rejectedCompOffs: 1,
    marker: TEST_MARKER,
  });
};

module.exports = { seedManagerTestData, TEST_MARKER };
