const AttendanceRecord = require('./attendanceRecord.model');
const EmployeeProfile = require('../employees/employeeProfile.model');
const EmployeeShiftAssignment = require('../shifts/employeeShiftAssignment.model');
const CompanyLeavePolicy = require('../leave-policies/companyLeavePolicy.model');
const CompanyAttendancePolicy = require('../attendance-policies/companyAttendancePolicy.model');
const { getDateOnly } = require('../../utils/time');

// Muster roll = monthly attendance register (employees × days grid).
// Each cell resolves to a short status code that HR can scan at a glance.
const STATUS_CODE = {
  present: 'P',
  regularized: 'P',
  auto_punch_out: 'P',
  late: 'L',
  half_day: 'HD',
  absent: 'A',
  holiday: 'H',
  week_off: 'WO',
  leave: 'LV',
  on_leave: 'LV',
  missing_punch: 'MP',
};

const LEGEND = {
  P: 'Present',
  L: 'Late',
  HD: 'Half day',
  A: 'Absent',
  LV: 'Leave',
  H: 'Holiday',
  WO: 'Week off',
  MP: 'Missing punch',
  NJ: 'Not joined',
  '-': 'No data',
};

const toDateKey = (date) => getDateOnly(date).toISOString().slice(0, 10);

const getDefaultLeavePolicy = async (companyId) => {
  const policy =
    (await CompanyLeavePolicy.findOne({ companyId, isDefault: true }, null, { companyId })) ||
    (await CompanyLeavePolicy.findOne({ companyId }, null, { companyId }));
  return policy;
};

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

const buildDayMeta = (year, month, holidayMap) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    const weekday = date.getDay();
    const dateKey = toDateKey(date);
    const holiday = holidayMap.get(dateKey);

    days.push({
      day,
      date: dateKey,
      weekday,
      isHoliday: Boolean(holiday),
      holidayName: holiday || null,
    });
  }

  return { daysInMonth, days };
};

const inferWorkingDaysFromWorkLocation = (workLocation) => {
  if (!workLocation) return null;
  const value = String(workLocation).trim();
  if (value.includes('6')) return [1, 2, 3, 4, 5, 6];
  if (value.includes('5')) return [1, 2, 3, 4, 5];
  return null;
};

const getEmployeeWorkingDays = (profile, assignment, companyFallback) => {
  const shiftDays = assignment?.shiftId?.workingDays;
  if (Array.isArray(shiftDays) && shiftDays.length) return shiftDays;

  const fromProfile = inferWorkingDaysFromWorkLocation(profile.workLocation);
  if (fromProfile) return fromProfile;

  return companyFallback;
};

const isWeekOff = (weekday, workingDays) => !workingDays.includes(weekday);

const emptySummary = () => ({
  present: 0,
  late: 0,
  halfDay: 0,
  absent: 0,
  leave: 0,
  holiday: 0,
  weekOff: 0,
  missingPunch: 0,
  payableDays: 0,
});

const resolveCellCode = ({ dayMeta, record, joiningDate, today, workingDays }) => {
  const cellDate = getDateOnly(dayMeta.date);

  // Before the employee joined → not applicable.
  if (joiningDate && cellDate < getDateOnly(joiningDate)) return 'NJ';

  // An actual attendance record always wins.
  if (record) return STATUS_CODE[record.attendanceStatus] || 'P';

  // No record: fall back to the employee's work week + company holidays.
  if (dayMeta.isHoliday) return 'H';
  if (isWeekOff(dayMeta.weekday, workingDays)) return 'WO';

  // Future working day with no record → nothing to show yet.
  if (cellDate > today) return '-';

  // Past working day with no record → absent.
  return 'A';
};

const applyToSummary = (summary, code) => {
  switch (code) {
    case 'P':
      summary.present += 1;
      summary.payableDays += 1;
      break;
    case 'L':
      summary.present += 1;
      summary.late += 1;
      summary.payableDays += 1;
      break;
    case 'HD':
      summary.halfDay += 1;
      summary.payableDays += 0.5;
      break;
    case 'LV':
      summary.leave += 1;
      summary.payableDays += 1;
      break;
    case 'H':
      summary.holiday += 1;
      summary.payableDays += 1;
      break;
    case 'WO':
      summary.weekOff += 1;
      summary.payableDays += 1;
      break;
    case 'MP':
      summary.missingPunch += 1;
      break;
    case 'A':
      summary.absent += 1;
      break;
    default:
      break;
  }
};

const getMusterRoll = async (companyId, query) => {
  const year = parseInt(query.year, 10) || new Date().getFullYear();
  const month = parseInt(query.month, 10) || new Date().getMonth() + 1;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const today = getDateOnly();

  const policy = await getDefaultLeavePolicy(companyId);
  const attendancePolicy = await CompanyAttendancePolicy.findOne(
    { companyId, isDefault: true },
    null,
    { companyId }
  );
  const companyWorkingDays = attendancePolicy?.workingDays?.length
    ? attendancePolicy.workingDays
    : DEFAULT_WORKING_DAYS;

  const holidayMap = new Map();
  (policy?.holidays || []).forEach((h) => {
    if (h?.date) holidayMap.set(toDateKey(h.date), h.name || 'Holiday');
  });

  const { daysInMonth, days } = buildDayMeta(year, month, holidayMap);

  // Scope employees for this company (optionally filter by department / status).
  const employeeFilter = { companyId, isDeleted: false };
  if (query.departmentId) employeeFilter.departmentId = query.departmentId;
  if (query.status) employeeFilter.status = query.status;
  if (query.search) {
    employeeFilter.employeeId = { $regex: query.search, $options: 'i' };
  }

  const total = await EmployeeProfile.countDocuments(employeeFilter);

  const profiles = await EmployeeProfile.find(employeeFilter, null, { companyId })
    .populate('userId', 'firstName lastName fullName email')
    .populate('departmentId', 'name code')
    .populate('designationId', 'name')
    .sort({ employeeId: 1 })
    .skip(skip)
    .limit(limit);

  const profileIds = profiles.map((p) => p._id);

  const [records, assignments] = await Promise.all([
    AttendanceRecord.find(
      {
        companyId,
        employeeProfileId: { $in: profileIds },
        date: { $gte: monthStart, $lte: monthEnd },
      },
      null,
      { companyId }
    ),
    EmployeeShiftAssignment.find(
      { companyId, employeeProfileId: { $in: profileIds }, isActive: true },
      null,
      { companyId }
    ).populate('shiftId', 'name code workingDays'),
  ]);

  const assignmentMap = new Map(
    assignments.map((assignment) => [String(assignment.employeeProfileId), assignment])
  );

  // Index records by profile + day for O(1) cell lookup.
  const recordMap = new Map();
  records.forEach((r) => {
    const profileKey = String(r.employeeProfileId);
    if (!recordMap.has(profileKey)) recordMap.set(profileKey, new Map());
    recordMap.get(profileKey).set(toDateKey(r.date), r);
  });

  const employees = profiles.map((profile) => {
    const profileKey = String(profile._id);
    const dayRecords = recordMap.get(profileKey);
    const assignment = assignmentMap.get(profileKey);
    const workingDays = getEmployeeWorkingDays(profile, assignment, companyWorkingDays);
    const summary = emptySummary();
    const cells = {};

    days.forEach((dayMeta) => {
      const record = dayRecords?.get(dayMeta.date);
      const code = resolveCellCode({
        dayMeta,
        record,
        joiningDate: profile.joiningDate,
        today,
        workingDays,
      });
      cells[dayMeta.day] = code;
      applyToSummary(summary, code);
    });

    return {
      employeeProfileId: profile._id,
      employeeId: profile.employeeId,
      name: profile.userId?.fullName
        || `${profile.userId?.firstName || ''} ${profile.userId?.lastName || ''}`.trim()
        || profile.employeeId,
      department: profile.departmentId?.name || null,
      designation: profile.designationId?.name || null,
      shift: assignment?.shiftId?.name || null,
      workingDays,
      status: profile.status,
      days: cells,
      summary,
    };
  });

  return {
    year,
    month,
    daysInMonth,
    days,
    legend: LEGEND,
    employees,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

module.exports = { getMusterRoll, STATUS_CODE, LEGEND };
