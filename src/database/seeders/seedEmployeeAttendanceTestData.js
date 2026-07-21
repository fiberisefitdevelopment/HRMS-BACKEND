const User = require('../../modules/users/user.model');
const EmployeeProfile = require('../../modules/employees/employeeProfile.model');
const EmployeeShiftAssignment = require('../../modules/shifts/employeeShiftAssignment.model');
const AttendanceRecord = require('../../modules/attendance/attendanceRecord.model');
const { dbLogger } = require('../../config/logger');
const { getDateOnly, parseTimeToMinutes } = require('../../utils/time');
const { isWeeklyOffDay } = require('../../modules/comp-off/compOff.eligibility');

const TEST_MARKER = '[ATTENDANCE_TEST_SEED]';
const TARGET_CODES = ['FR0003', 'FR0005'];

const LOCATION = { latitude: 28.5355, longitude: 77.391, accuracyMeters: 20 };

const parseLocalDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const buildPunchMeta = (date, timeStr, source = 'web') => ({
  timestamp: combineDateTime(date, timeStr),
  source,
  latitude: LOCATION.latitude,
  longitude: LOCATION.longitude,
  accuracyMeters: LOCATION.accuracyMeters,
});

const combineDateTime = (date, timeStr) => {
  const d = getDateOnly(date);
  const normalized = timeStr.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return d;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const meridiem = match[3];
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  d.setHours(hours, mins, 0, 0);
  return d;
};

const computeLateByMinutes = (punchInTime, shiftStart = '09:00 AM', grace = 15) => {
  const punchMinutes = punchInTime.getHours() * 60 + punchInTime.getMinutes();
  const threshold = parseTimeToMinutes(shiftStart) + grace;
  if (punchMinutes <= threshold) return 0;
  return punchMinutes - parseTimeToMinutes(shiftStart);
};

const computeWorkingMinutes = (punchInAt, punchOutAt) => {
  if (!punchInAt || !punchOutAt) return 0;
  return Math.max(0, Math.round((punchOutAt.getTime() - punchInAt.getTime()) / 60000));
};

const buildAttendanceRecord = ({
  companyId,
  profile,
  userId,
  shiftId,
  date,
  scenario,
  actorId,
}) => {
  const workingDays = [1, 2, 3, 4, 5];
  const isWeekend = isWeeklyOffDay(workingDays, date);
  const base = {
    companyId,
    employeeProfileId: profile._id,
    userId,
    shiftId,
    date: getDateOnly(date),
    attendanceSource: 'web',
    remarks: TEST_MARKER,
    createdBy: actorId,
    updatedBy: actorId,
  };

  if (scenario === 'week_off') {
    return { ...base, attendanceStatus: 'week_off', punchSessions: [] };
  }

  if (scenario === 'absent') {
    return { ...base, attendanceStatus: 'absent', punchSessions: [] };
  }

  const punchInTime = combineDateTime(date, scenario.punchIn);
  const punchOutTime = scenario.punchOut ? combineDateTime(date, scenario.punchOut) : null;
  const punchIn = buildPunchMeta(date, scenario.punchIn);
  const punchOut = punchOutTime ? buildPunchMeta(date, scenario.punchOut) : undefined;
  const punchSessions = punchOut ? [{ punchIn, punchOut }] : [{ punchIn, punchOut: undefined }];

  let attendanceStatus = scenario.status || 'present';
  let lateByMinutes = 0;
  let grossWorkingMinutes = 0;
  let netWorkingMinutes = 0;

  if (!punchOutTime) {
    attendanceStatus = 'missing_punch';
  } else {
    grossWorkingMinutes = computeWorkingMinutes(punchInTime, punchOutTime);
    netWorkingMinutes = Math.max(0, grossWorkingMinutes - 30);
    lateByMinutes = computeLateByMinutes(punchInTime);
    if (attendanceStatus === 'present' && lateByMinutes > 0) {
      attendanceStatus = 'late';
    }
  }

  if (isWeekend && punchOutTime) {
    attendanceStatus = 'present';
    lateByMinutes = 0;
  }

  return {
    ...base,
    punchIn,
    punchOut,
    punchSessions,
    lastKnownLocation: {
      ...LOCATION,
      recordedAt: punchInTime,
      source: 'punch',
    },
    grossWorkingMinutes,
    netWorkingMinutes,
    lateByMinutes,
    attendanceStatus,
  };
};

/** July 2026 attendance scenarios for leave / comp-off / regularization testing. */
const SCENARIOS = {
  FR0003: {
    '2026-07-01': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-02': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-03': { punchIn: '10:15 AM', punchOut: '06:00 PM' },
    '2026-07-04': { punchIn: '10:00 AM', punchOut: '07:30 PM' },
    '2026-07-05': 'week_off',
    '2026-07-06': { punchIn: '09:00 AM', punchOut: '08:00 PM' },
    '2026-07-07': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-08': 'absent',
    '2026-07-09': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-10': { punchIn: '09:05 AM', punchOut: '06:00 PM' },
    '2026-07-11': 'week_off',
    '2026-07-12': 'week_off',
    '2026-07-13': { punchIn: '09:00 AM' },
    '2026-07-14': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-15': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-16': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-17': { punchIn: '09:00 AM', punchOut: '07:30 PM' },
    '2026-07-18': 'week_off',
    '2026-07-19': 'week_off',
    '2026-07-20': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
  },
  FR0005: {
    '2026-07-01': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-02': { punchIn: '10:00 AM', punchOut: '06:00 PM' },
    '2026-07-03': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-04': { punchIn: '10:00 AM', punchOut: '02:00 PM' },
    '2026-07-05': 'week_off',
    '2026-07-06': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-07': 'absent',
    '2026-07-08': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-09': { punchIn: '10:30 AM', punchOut: '06:00 PM' },
    '2026-07-10': { punchIn: '09:00 AM', punchOut: '10:00 PM' },
    '2026-07-11': { punchIn: '10:00 AM', punchOut: '06:00 PM' },
    '2026-07-12': 'week_off',
    '2026-07-13': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-14': { punchIn: '09:00 AM' },
    '2026-07-15': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-16': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-17': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
    '2026-07-18': 'week_off',
    '2026-07-19': 'week_off',
    '2026-07-20': { punchIn: '09:00 AM', punchOut: '06:00 PM' },
  },
};

const seedEmployeeAttendanceTestData = async () => {
  const existing = await AttendanceRecord.findOne({ remarks: TEST_MARKER });
  if (existing) {
    dbLogger.info('Employee attendance test data already seeded — skipping');
    return;
  }

  let created = 0;

  for (const code of TARGET_CODES) {
    const user = await User.findOne({ employeeCode: code });
    const profile = await EmployeeProfile.findOne({ employeeId: code, isDeleted: false });
    if (!user || !profile) {
      dbLogger.warn(`Employee ${code} not found — skipping attendance seed`);
      continue;
    }

    const assignment = await EmployeeShiftAssignment.findOne({
      companyId: profile.companyId,
      employeeProfileId: profile._id,
      isActive: true,
    });
    const scenarios = SCENARIOS[code];
    if (!scenarios) continue;

    for (const [dateStr, scenario] of Object.entries(scenarios)) {
      const date = parseLocalDate(dateStr);
      const payload = buildAttendanceRecord({
        companyId: profile.companyId,
        profile,
        userId: user._id,
        shiftId: assignment?.shiftId,
        date,
        scenario,
        actorId: user._id,
      });

      await AttendanceRecord.create(payload);
      created += 1;
    }

    dbLogger.info(`Attendance test data seeded for ${code}`, { days: Object.keys(scenarios).length });
  }

  dbLogger.info('Employee attendance test data complete', {
    employees: TARGET_CODES,
    recordsCreated: created,
    marker: TEST_MARKER,
  });
};

module.exports = { seedEmployeeAttendanceTestData, TEST_MARKER, SCENARIOS };
