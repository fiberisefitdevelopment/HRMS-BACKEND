const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { SYSTEM_ROLES, LEAVE_TYPES } = require('../../constants');
const { getDateOnly, minutesToTimeString, formatDateOnly } = require('../../utils/time');
const { getEmployeeProfileByUser } = require('../leave/leave.helper');
const attendanceRepository = require('../attendance/attendance.repository');
const workingHoursEngine = require('../attendance/engines/workingHours.engine');
const shiftEngine = require('../attendance/engines/shift.engine');
const ledgerEngine = require('../leave/engines/ledger.engine');
const { notifyBalanceUpdated } = require('../../helpers/notification');
const compOffRequestRepository = require('./compOffRequest.repository');
const { computeOvertimeMinutes, computeWorkedMinutes, isWeeklyOffDay, resolveCompOffEligibility, buildEligibilityMessage, formatDuration } = require('./compOff.eligibility');

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

const formatCompOff = (doc) => {
  const status = doc.status;
  return {
    id: doc._id,
    companyId: formatId(doc.companyId),
    employeeProfileId: formatId(doc.employeeProfileId),
    userId: formatId(doc.userId),
    user: formatUserRef(doc.userId),
    employee:
      doc.employeeProfileId && typeof doc.employeeProfileId === 'object' && doc.employeeProfileId.employeeId != null
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
    shiftEndTime: doc.shiftEndTime || null,
    punchOutAt: doc.punchOutAt || null,
    overtimeMinutes: doc.overtimeMinutes,
    eligibilityType: doc.eligibilityType,
    requestedDays: doc.requestedDays,
    reason: doc.reason,
    status,
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

const assertCanApprove = (request, actorId, actorRole) => {
  if (request.status !== 'pending') {
    throw ApiError.badRequest('Comp-off request is not pending approval');
  }

  if ([SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(actorRole)) return;

  if (actorRole === SYSTEM_ROLES.MANAGER) {
    if (request.managerId && request.managerId.toString() !== actorId.toString()) {
      throw ApiError.forbidden('You are not the manager for this employee');
    }
    return;
  }

  throw ApiError.forbidden('You are not authorized to approve this comp-off request');
};

const resolveEligibilityContext = async (userId, companyId, dateInput) => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const attendanceDate = getDateOnly(dateInput || new Date());

  const record = await attendanceRepository.findTodayRecord(profile._id, companyId, attendanceDate);
  if (!record) {
    throw ApiError.badRequest('No attendance record found for this date');
  }

  if (workingHoursEngine.hasOpenSession(record)) {
    throw ApiError.badRequest('Punch out is required before raising a comp-off request');
  }

  const punchOut = workingHoursEngine.getLastPunchOut(record);
  if (!punchOut?.timestamp) {
    throw ApiError.badRequest('No punch-out found for this date');
  }

  const punchIn = workingHoursEngine.getFirstPunchIn(record);
  const shiftConfig = await shiftEngine.getEmployeeShift(profile._id, companyId);
  const shiftEndTime = shiftEngine.getShiftEndDateTime(attendanceDate, shiftConfig);
  const punchOutAt = new Date(punchOut.timestamp);
  const punchInAt = punchIn?.timestamp ? new Date(punchIn.timestamp) : null;
  const overtimeMinutes = computeOvertimeMinutes(shiftEndTime, punchOutAt);
  const workedMinutes = computeWorkedMinutes(punchInAt, punchOutAt);
  const isWeeklyOff = isWeeklyOffDay(shiftConfig.workingDays, attendanceDate);
  const resolved = resolveCompOffEligibility({
    isWeeklyOff,
    overtimeMinutes,
    workedMinutes,
    hasPunchOut: true,
  });
  const shiftId =
    shiftConfig.shift?._id ||
    shiftConfig.shift?.id ||
    (typeof shiftConfig._id !== 'undefined' ? shiftConfig._id : null);

  const existing = await compOffRequestRepository.findActiveForDate(
    profile._id,
    companyId,
    attendanceDate
  );

  return {
    profile,
    attendanceDate,
    record,
    shiftConfig,
    shiftId,
    shiftEndTime,
    punchInAt,
    punchOutAt,
    overtimeMinutes: resolved.overtimeMinutes,
    workedMinutes: resolved.workedMinutes,
    durationMinutes: resolved.durationMinutes,
    eligibleDays: resolved.eligibleDays,
    eligibilityType: resolved.eligibilityType,
    isWeeklyOff,
    existing,
  };
};

const getEligibility = async (userId, companyId, date) => {
  const ctx = await resolveEligibilityContext(userId, companyId, date);
  const isEligible = ctx.eligibleDays > 0;

  return {
    date: formatDateOnly(ctx.attendanceDate),
    attendanceRecordId: ctx.record._id,
    shiftEndTime: ctx.shiftEndTime,
    shiftEndDisplay: minutesToTimeString(ctx.shiftConfig.shiftEndMinutes),
    workingDays: ctx.shiftConfig.workingDays || [],
    isWeeklyOff: ctx.isWeeklyOff,
    punchInAt: ctx.punchInAt,
    punchOutAt: ctx.punchOutAt,
    /** Minutes used for credit: OT after shift (weekday) OR hours worked (weekly off) */
    durationMinutes: ctx.durationMinutes,
    durationHours: Math.round((ctx.durationMinutes / 60) * 100) / 100,
    durationDisplay: formatDuration(ctx.durationMinutes),
    overtimeMinutes: ctx.overtimeMinutes,
    workedMinutes: ctx.workedMinutes,
    eligibleDays: ctx.eligibleDays,
    eligibilityType: ctx.eligibilityType,
    isEligible,
    message: buildEligibilityMessage({
      isWeeklyOff: ctx.isWeeklyOff,
      durationMinutes: ctx.durationMinutes,
      eligibleDays: ctx.eligibleDays,
      isEligible,
    }),
    hasExistingRequest: Boolean(ctx.existing),
    existingRequestId: ctx.existing?._id || null,
    existingStatus: ctx.existing?.status || null,
  };
};

const raiseCompOff = async (data, actorId, companyId, req) => {
  const ctx = await resolveEligibilityContext(actorId, companyId, data.date);

  if (ctx.eligibleDays <= 0) {
    throw ApiError.badRequest(
      buildEligibilityMessage({
        isWeeklyOff: ctx.isWeeklyOff,
        durationMinutes: ctx.durationMinutes,
        eligibleDays: 0,
        isEligible: false,
      })
    );
  }

  if (ctx.existing) {
    throw ApiError.conflict(
      `A ${ctx.existing.status} comp-off request already exists for this date`
    );
  }

  const request = await compOffRequestRepository.create({
    companyId,
    employeeProfileId: ctx.profile._id,
    userId: actorId,
    managerId: ctx.profile.managerId,
    attendanceDate: ctx.attendanceDate,
    attendanceRecordId: ctx.record._id,
    shiftId: ctx.shiftId,
    shiftEndTime: ctx.shiftEndTime,
    punchOutAt: ctx.punchOutAt,
    overtimeMinutes: ctx.durationMinutes,
    eligibilityType: ctx.eligibilityType,
    requestedDays: ctx.eligibleDays,
    reason: data.reason || '',
    status: 'pending',
    createdBy: actorId,
    updatedBy: actorId,
  });

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: actorId,
    action: 'comp_off_raise',
    entityType: 'comp_off_request',
    entityId: request._id,
    changes: { after: formatCompOff(request) },
    req,
  });

  return formatCompOff(request);
};

const findDetailed = (id, companyId) =>
  compOffRequestRepository.model
    .findOne({ _id: id, companyId }, null, { companyId })
    .populate('employeeProfileId', 'employeeId departmentId')
    .populate('userId', 'firstName lastName fullName email')
    .populate('managerId', 'firstName lastName fullName email')
    .populate('approvedBy', 'firstName lastName fullName email')
    .populate('rejectedBy', 'firstName lastName fullName email');

const cancelCompOff = async (id, reason, actorId, companyId, req) => {
  const request = await compOffRequestRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!request) throw ApiError.notFound('Comp-off request not found');

  const actorRole = await getActorRole(actorId);
  const isOwner = request.userId.toString() === actorId.toString();
  const isPrivileged = [SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(actorRole);

  if (!isOwner && !isPrivileged) {
    throw ApiError.forbidden('You can only cancel your own comp-off requests');
  }
  if (request.status !== 'pending') {
    throw ApiError.badRequest('Only pending comp-off requests can be cancelled');
  }

  await compOffRequestRepository.updateById(
    id,
    {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason || 'Cancelled by requester',
      updatedBy: actorId,
    },
    { companyId }
  );

  const updated = await findDetailed(id, companyId);

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: request.userId,
    action: 'comp_off_cancel',
    entityType: 'comp_off_request',
    entityId: id,
    metadata: { reason },
    req,
  });

  return formatCompOff(updated);
};

const creditOnApproval = async (request, actorId) => {
  const { closingBalance } = await ledgerEngine.creditLeave({
    companyId: request.companyId,
    employeeProfileId: request.employeeProfileId,
    userId: request.userId,
    leaveType: LEAVE_TYPES.COMP_OFF,
    leaveTypeCode: 'COMP_OFF',
    amount: request.requestedDays,
    reason: `Comp-off approved for ${formatDateOnly(request.attendanceDate)} (${request.eligibilityType === 'weekly_off' ? 'weekly off' : `${request.overtimeMinutes}m OT`})`,
    referenceType: 'comp_off_request',
    referenceId: request._id,
    createdBy: actorId,
  });

  await notifyBalanceUpdated(
    request.companyId,
    request.userId,
    'COMP_OFF',
    closingBalance,
    'Credited after comp-off approval'
  );

  return closingBalance;
};

const approveCompOff = async (id, comment, actorId, companyId, req) => {
  const request = await compOffRequestRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!request) throw ApiError.notFound('Comp-off request not found');

  const actorRole = await getActorRole(actorId);
  assertCanApprove(request, actorId, actorRole);

  await compOffRequestRepository.updateById(
    id,
    {
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: actorId,
      approvedComment: comment || null,
      updatedBy: actorId,
    },
    { companyId }
  );

  const updated = await compOffRequestRepository.findById(id, null, { companyId });
  await creditOnApproval(updated, actorId);

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: request.userId,
    action: 'comp_off_approve',
    entityType: 'comp_off_request',
    entityId: id,
    metadata: { comment },
    req,
  });

  return formatCompOff(await findDetailed(id, companyId));
};

const rejectCompOff = async (id, comment, actorId, companyId, req) => {
  const request = await compOffRequestRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!request) throw ApiError.notFound('Comp-off request not found');

  const actorRole = await getActorRole(actorId);
  assertCanApprove(request, actorId, actorRole);

  await compOffRequestRepository.updateById(
    id,
    {
      status: 'rejected',
      rejectedBy: actorId,
      rejectedReason: comment || null,
      updatedBy: actorId,
    },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: request.userId,
    action: 'comp_off_reject',
    entityType: 'comp_off_request',
    entityId: id,
    metadata: { comment },
    req,
  });

  return formatCompOff(await findDetailed(id, companyId));
};

const getCompOff = async (id, companyId, requester) => {
  const request = await findDetailed(id, companyId);
  if (!request) throw ApiError.notFound('Comp-off request not found');

  const actorRole = await getActorRole(requester.id);
  const ownerId = request.userId?._id?.toString() || request.userId.toString();

  if (actorRole === SYSTEM_ROLES.EMPLOYEE && ownerId !== requester.id.toString()) {
    throw ApiError.forbidden('Access denied');
  }

  if (actorRole === SYSTEM_ROLES.MANAGER) {
    const isOwn = ownerId === requester.id.toString();
    const isTeam = request.managerId?._id?.toString() === requester.id.toString()
      || request.managerId?.toString() === requester.id.toString();
    if (!isOwn && !isTeam) throw ApiError.forbidden('Access denied');
  }

  return formatCompOff(request);
};

const listCompOff = async (companyId, query, requester) => {
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

  const result = await compOffRequestRepository.findWithFilters(filter, query, { companyId });
  return {
    data: result.data.map(formatCompOff),
    meta: result.meta,
  };
};

module.exports = {
  getEligibility,
  raiseCompOff,
  cancelCompOff,
  approveCompOff,
  rejectCompOff,
  getCompOff,
  listCompOff,
  creditOnApproval,
  formatCompOff,
};
