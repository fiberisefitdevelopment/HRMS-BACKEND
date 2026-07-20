const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { SYSTEM_ROLES } = require('../../constants');
const { getDateOnly, formatDateOnly, getMonthYear } = require('../../utils/time');
const { getEmployeeProfileByUser } = require('../leave/leave.helper');
const attendanceRepository = require('../attendance/attendance.repository');
const workingHoursEngine = require('../attendance/engines/workingHours.engine');
const shiftEngine = require('../attendance/engines/shift.engine');
const regularizationEngine = require('../attendance/engines/regularization.engine');
const RegularizationCounter = require('../attendance/regularizationCounter.model');
const regularizationRequestRepository = require('./regularizationRequest.repository');
const {
  getPolicyRegularization,
  resolveEligibility,
  minutesToTimeString,
  isWeeklyOffDay,
} = require('./regularization.eligibility');

const getActorRole = async (userId) => {
  const User = require('../users/user.model');
  const user = await User.findById(userId).populate('roleId', 'slug');
  return user?.roleId?.slug;
};

const formatUserRef = (user) => {
  if (!user || typeof user !== 'object') return null;
  const id = user._id ?? user.id;
  if (!id) return null;
  return {
    id,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  };
};

const formatId = (value) => {
  if (!value) return value ?? null;
  if (typeof value === 'object') return value._id ?? value.id ?? null;
  return value;
};

const formatRequest = (doc) => {
  const status = doc.status;
  return {
    id: doc._id,
    companyId: formatId(doc.companyId),
    employeeProfileId: formatId(doc.employeeProfileId),
    userId: formatId(doc.userId),
    user: formatUserRef(doc.userId),
    employee:
      doc.employeeProfileId &&
      typeof doc.employeeProfileId === 'object' &&
      doc.employeeProfileId.employeeId != null
        ? {
            id: doc.employeeProfileId._id ?? doc.employeeProfileId.id,
            employeeId: doc.employeeProfileId.employeeId,
          }
        : null,
    managerId: formatId(doc.managerId),
    manager: formatUserRef(doc.managerId),
    attendanceDate: doc.attendanceDate ? formatDateOnly(doc.attendanceDate) : null,
    attendanceRecordId: formatId(doc.attendanceRecordId),
    shiftId: formatId(doc.shiftId),
    originalPunchInAt: doc.originalPunchInAt || null,
    originalPunchOutAt: doc.originalPunchOutAt || null,
    originalStatus: doc.originalStatus || null,
    requestedPunchInAt: doc.requestedPunchInAt || null,
    requestedPunchOutAt: doc.requestedPunchOutAt || null,
    lateByMinutes: doc.lateByMinutes || 0,
    reason: doc.reason,
    status,
    appliedStatus: doc.appliedStatus || null,
    approvedBy: status === 'approved' ? formatUserRef(doc.approvedBy) : null,
    approvedAt: status === 'approved' ? doc.approvedAt || null : null,
    approvedComment: status === 'approved' ? doc.approvedComment || null : null,
    rejectedBy: status === 'rejected' ? formatUserRef(doc.rejectedBy) : null,
    rejectedReason: status === 'rejected' ? doc.rejectedReason || null : null,
    cancelledAt: doc.cancelledAt || null,
    cancelledReason: doc.cancelledReason || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

const getApprovedCountThisMonth = async (employeeProfileId, companyId, date) => {
  const { year, month } = getMonthYear(date);
  const counter = await RegularizationCounter.findOne(
    { companyId, employeeProfileId, year, month },
    null,
    { companyId }
  );
  return counter?.count || 0;
};

const resolveContext = async (userId, companyId, dateInput) => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const attendanceDate = getDateOnly(dateInput || new Date());
  const record = await attendanceRepository.findTodayRecord(profile._id, companyId, attendanceDate);

  if (!record) {
    throw ApiError.badRequest('No attendance record found for this date');
  }

  const punchIn = workingHoursEngine.getFirstPunchIn(record);
  if (!punchIn?.timestamp) {
    throw ApiError.badRequest('Punch in is required before requesting regularization');
  }

  const punchOut = workingHoursEngine.getLastPunchOut(record);
  const shiftConfig = await shiftEngine.getEmployeeShift(profile._id, companyId);
  const policy = getPolicyRegularization(shiftConfig);
  const isWeeklyOff = isWeeklyOffDay(shiftConfig.workingDays, attendanceDate);
  const lateResult = isWeeklyOff
    ? { isLate: false, lateByMinutes: 0 }
    : regularizationEngine.evaluateLateArrival(punchIn.timestamp, shiftConfig);

  const usedFromCounter = await getApprovedCountThisMonth(profile._id, companyId, attendanceDate);
  const pendingOrApproved = await regularizationRequestRepository.countUsedInMonth(
    profile._id,
    companyId,
    attendanceDate
  );
  // Cap "used" at the larger of counter vs active requests (avoid double-counting mismatch)
  const usedThisMonth = Math.max(usedFromCounter, pendingOrApproved);

  const existing = await regularizationRequestRepository.findActiveForDate(
    profile._id,
    companyId,
    attendanceDate
  );

  const eligibility = resolveEligibility({
    policy,
    punchInAt: punchIn.timestamp,
    usedThisMonth,
    alreadyRegularized: Boolean(record.isRegularized) || record.attendanceStatus === 'regularized',
    isWeeklyOff,
    workingDays: shiftConfig.workingDays || [],
  });

  const shiftId =
    shiftConfig.shift?._id ||
    shiftConfig.shift?.id ||
    record.shiftId ||
    null;

  return {
    profile,
    attendanceDate,
    record,
    shiftConfig,
    shiftId,
    policy,
    punchInAt: new Date(punchIn.timestamp),
    punchOutAt: punchOut?.timestamp ? new Date(punchOut.timestamp) : null,
    lateByMinutes: isWeeklyOff ? 0 : lateResult.lateByMinutes || record.lateByMinutes || 0,
    usedThisMonth,
    remaining: eligibility.remaining,
    existing,
    eligibility,
    isWeeklyOff,
  };
};

const getEligibility = async (userId, companyId, date) => {
  const ctx = await resolveContext(userId, companyId, date);

  return {
    date: formatDateOnly(ctx.attendanceDate),
    attendanceRecordId: ctx.record._id,
    policy: {
      enabled: ctx.policy.enabled,
      windowStart: ctx.policy.windowStart,
      windowEnd: ctx.policy.windowEnd,
      monthlyLimit: ctx.policy.monthlyLimit,
      exceedingAction: ctx.policy.exceedingAction,
    },
    windowDisplay: `${ctx.policy.windowStart} – ${ctx.policy.windowEnd}`,
    punchInAt: ctx.punchInAt,
    punchInDisplay: minutesToTimeString(
      require('../../utils/time').getMinutesFromDate(ctx.punchInAt)
    ),
    punchOutAt: ctx.punchOutAt,
    lateByMinutes: ctx.isWeeklyOff ? 0 : ctx.lateByMinutes,
    originalStatus: ctx.record.attendanceStatus,
    isAlreadyRegularized:
      Boolean(ctx.record.isRegularized) || ctx.record.attendanceStatus === 'regularized',
    usedThisMonth: ctx.usedThisMonth,
    remaining: ctx.remaining,
    inWindow: ctx.eligibility.inWindow,
    isWeeklyOff: Boolean(ctx.eligibility.isWeeklyOff),
    workingDays: ctx.shiftConfig.workingDays || [],
    isEligible: ctx.eligibility.isEligible && !ctx.existing,
    message: ctx.existing
      ? `A ${ctx.existing.status} regularization request already exists for this date`
      : ctx.eligibility.message,
    hasExistingRequest: Boolean(ctx.existing),
    existingRequestId: ctx.existing?._id || null,
    existingStatus: ctx.existing?.status || null,
  };
};

const raiseRegularization = async (data, actorId, companyId, req) => {
  const ctx = await resolveContext(actorId, companyId, data.date);

  if (ctx.existing) {
    throw ApiError.conflict(
      `A ${ctx.existing.status} regularization request already exists for this date`
    );
  }

  if (!ctx.eligibility.isEligible) {
    throw ApiError.badRequest(ctx.eligibility.message);
  }

  const requestedPunchInAt = data.requestedPunchIn
    ? new Date(data.requestedPunchIn)
    : ctx.punchInAt;
  const requestedPunchOutAt = data.requestedPunchOut
    ? new Date(data.requestedPunchOut)
    : ctx.punchOutAt;

  // Manual apply by employee — auto-approved per policy (no manager approval step)
  const request = await regularizationRequestRepository.create({
    companyId,
    employeeProfileId: ctx.profile._id,
    userId: actorId,
    managerId: ctx.profile.managerId,
    attendanceDate: ctx.attendanceDate,
    attendanceRecordId: ctx.record._id,
    shiftId: ctx.shiftId,
    originalPunchInAt: ctx.punchInAt,
    originalPunchOutAt: ctx.punchOutAt,
    originalStatus: ctx.record.attendanceStatus,
    requestedPunchInAt,
    requestedPunchOutAt,
    lateByMinutes: ctx.lateByMinutes,
    reason: data.reason,
    status: 'pending',
    createdBy: actorId,
    updatedBy: actorId,
  });

  const appliedStatus = await applyApprovalToAttendance(request, actorId);

  await regularizationRequestRepository.updateById(
    request._id,
    {
      status: 'approved',
      appliedStatus,
      approvedAt: new Date(),
      approvedBy: actorId,
      approvedComment: 'Auto-approved',
      updatedBy: actorId,
    },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: actorId,
    action: 'regularization_raise_auto_approve',
    entityType: 'regularization_request',
    entityId: request._id,
    metadata: { appliedStatus },
    req,
  });

  return formatRequest(await findDetailed(request._id, companyId));
};

const findDetailed = (id, companyId) =>
  regularizationRequestRepository.model
    .findOne({ _id: id, companyId }, null, { companyId })
    .populate('employeeProfileId', 'employeeId departmentId')
    .populate('userId', 'firstName lastName fullName email')
    .populate('managerId', 'firstName lastName fullName email')
    .populate('approvedBy', 'firstName lastName fullName email')
    .populate('rejectedBy', 'firstName lastName fullName email');

const applyApprovalToAttendance = async (request, actorId) => {
  const shiftConfig = await shiftEngine.getEmployeeShift(
    request.employeeProfileId,
    request.companyId
  );
  const policy = getPolicyRegularization(shiftConfig);
  const approvedCount = await getApprovedCountThisMonth(
    request.employeeProfileId,
    request.companyId,
    request.attendanceDate
  );

  const withinLimit = approvedCount < policy.monthlyLimit;
  let appliedStatus = 'regularized';
  let isRegularized = true;

  if (!withinLimit) {
    appliedStatus = policy.exceedingAction || 'half_day';
    isRegularized = false;
  }

  const record = await attendanceRepository.findById(
    request.attendanceRecordId,
    null,
    { companyId: request.companyId }
  );
  if (!record) throw ApiError.notFound('Attendance record not found');

  const sessions = workingHoursEngine.getSessions(record);
  const punchInTs = request.requestedPunchInAt || request.originalPunchInAt;
  const punchOutTs = request.requestedPunchOutAt || request.originalPunchOutAt;

  let nextSessions = sessions;
  if (sessions.length > 0) {
    nextSessions = sessions.map((s, idx) => {
      if (idx !== 0) return s;
      return {
        punchIn: {
          ...(s.punchIn || {}),
          timestamp: punchInTs,
          source: s.punchIn?.source || 'manual',
        },
        punchOut: punchOutTs
          ? {
              ...(s.punchOut || {}),
              timestamp: punchOutTs,
              source: s.punchOut?.source || 'manual',
            }
          : s.punchOut || null,
      };
    });
  } else {
    nextSessions = [
      {
        punchIn: { timestamp: punchInTs, source: 'manual' },
        punchOut: punchOutTs ? { timestamp: punchOutTs, source: 'manual' } : null,
      },
    ];
  }

  const firstPunchIn = workingHoursEngine.getFirstPunchIn({ punchSessions: nextSessions });
  const lastPunchOut = workingHoursEngine.getLastPunchOut({ punchSessions: nextSessions });

  const counter = await regularizationEngine.getOrCreateCounter(
    request.companyId,
    request.employeeProfileId,
    request.userId,
    request.attendanceDate
  );
  await RegularizationCounter.updateOne({ _id: counter._id }, { $inc: { count: 1 } });

  await attendanceRepository.updateById(
    request.attendanceRecordId,
    {
      punchSessions: nextSessions,
      punchIn: firstPunchIn,
      punchOut: lastPunchOut,
      isRegularized,
      attendanceStatus: appliedStatus,
      regularizationMonthCount: (counter.count || 0) + 1,
      lateByMinutes: isRegularized ? 0 : request.lateByMinutes || 0,
      updatedBy: actorId,
      remarks: `Regularization ${isRegularized ? 'approved' : `applied as ${appliedStatus}`}`,
    },
    { companyId: request.companyId }
  );

  return appliedStatus;
};

const getRegularization = async (id, companyId, requester) => {
  const request = await findDetailed(id, companyId);
  if (!request) throw ApiError.notFound('Regularization request not found');

  const actorRole = await getActorRole(requester.id);
  const ownerId = request.userId?._id?.toString() || request.userId.toString();

  if (actorRole === SYSTEM_ROLES.EMPLOYEE && ownerId !== requester.id.toString()) {
    throw ApiError.forbidden('Access denied');
  }

  if (actorRole === SYSTEM_ROLES.MANAGER) {
    const isOwn = ownerId === requester.id.toString();
    const isTeam =
      request.managerId?._id?.toString() === requester.id.toString() ||
      request.managerId?.toString() === requester.id.toString();
    if (!isOwn && !isTeam) throw ApiError.forbidden('Access denied');
  }

  return formatRequest(request);
};

const listRegularization = async (companyId, query, requester) => {
  const filter = { companyId };
  const actorRole = await getActorRole(requester.id);

  if (query.status) filter.status = query.status;
  if (query.employeeProfileId) filter.employeeProfileId = query.employeeProfileId;

  if (actorRole === SYSTEM_ROLES.EMPLOYEE) {
    filter.userId = requester.id;
  } else if (actorRole === SYSTEM_ROLES.MANAGER) {
    if (query.scope === 'self') {
      filter.userId = requester.id;
    } else if (!query.all) {
      filter.managerId = requester.id;
    }
  }

  const result = await regularizationRequestRepository.findWithFilters(filter, query, {
    companyId,
  });
  return {
    data: result.data.map(formatRequest),
    meta: result.meta,
  };
};

module.exports = {
  getEligibility,
  raiseRegularization,
  getRegularization,
  listRegularization,
  formatRequest,
};
