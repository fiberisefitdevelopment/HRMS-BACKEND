const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { SYSTEM_ROLES } = require('../../constants');
const { getDateOnly, formatDateOnly } = require('../../utils/time');
const { getEmployeeProfileByUser } = require('../leave/leave.helper');
const policyEngine = require('../attendance/engines/policy.engine');
const shiftEngine = require('../attendance/engines/shift.engine');
const { isWeeklyOffDay } = require('../comp-off/compOff.eligibility');
const AttendanceRecord = require('../attendance/attendanceRecord.model');
const RegularizationRequest = require('../regularization/regularizationRequest.model');
const leaveRequestRepository = require('../leave/leaveRequest.repository');
const wfhRequestRepository = require('./wfhRequest.repository');

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

const getWeeklyOffMessage = (workingDays) => {
  const days = Array.isArray(workingDays) ? workingDays : [];
  const isFiveDay = days.length === 5 && !days.includes(0) && !days.includes(6);
  return isFiveDay
    ? 'Work from home cannot be applied on Saturday or Sunday (weekly off)'
    : 'Work from home cannot be applied on Sunday (weekly off)';
};

const assertNotWeeklyOff = (workingDays, date) => {
  if (isWeeklyOffDay(workingDays, date)) {
    throw ApiError.badRequest(getWeeklyOffMessage(workingDays));
  }
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
    date: doc.date ? formatDateOnly(doc.date) : null,
    attendanceRecordId: formatId(doc.attendanceRecordId),
    reason: doc.reason || '',
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

const findDetailed = (id, companyId) =>
  wfhRequestRepository.model
    .findOne({ _id: id, companyId }, null, { companyId })
    .populate('employeeProfileId', 'employeeId departmentId')
    .populate('userId', 'firstName lastName fullName email')
    .populate('managerId', 'firstName lastName fullName email')
    .populate('approvedBy', 'firstName lastName fullName email')
    .populate('rejectedBy', 'firstName lastName fullName email');

const applyWfhToAttendance = async ({ companyId, employeeProfileId, userId, date, actorId }) => {
  const day = getDateOnly(date);
  const existing = await AttendanceRecord.findOne({ companyId, employeeProfileId, date: day }, null, {
    companyId,
  });

  if (existing) {
    const updated = await AttendanceRecord.findByIdAndUpdate(
      existing._id,
      {
        attendanceStatus: 'work_from_home',
        remarks: 'Work from home',
        updatedBy: actorId,
      },
      { new: true }
    );
    return updated;
  }

  return AttendanceRecord.create({
    companyId,
    employeeProfileId,
    userId,
    date: day,
    attendanceStatus: 'work_from_home',
    remarks: 'Work from home',
    createdBy: actorId,
    updatedBy: actorId,
  });
};

const assertNoConflicts = async (employeeProfileId, companyId, date, { excludeWfhId } = {}) => {
  const day = getDateOnly(date);

  const existingWfh = await wfhRequestRepository.findActiveForDate(employeeProfileId, companyId, day);
  if (
    existingWfh &&
    (!excludeWfhId || existingWfh._id.toString() !== excludeWfhId.toString())
  ) {
    throw ApiError.conflict(`A ${existingWfh.status} work-from-home request already exists for this date`);
  }

  const existingReg = await RegularizationRequest.findOne(
    {
      companyId,
      employeeProfileId,
      attendanceDate: day,
      status: { $in: ['pending', 'approved'] },
    },
    null,
    { companyId }
  );
  if (existingReg) {
    throw ApiError.conflict('Cannot apply work from home — regularization is already applied for this date');
  }

  const overlappingLeave = await leaveRequestRepository.findOverlapping(
    employeeProfileId,
    companyId,
    day,
    day
  );
  if (overlappingLeave.length > 0) {
    throw ApiError.conflict('Cannot apply work from home — leave is already applied for this date');
  }

  const record = await AttendanceRecord.findOne({ companyId, employeeProfileId, date: day }, null, {
    companyId,
  });
  if (record && ['present', 'late', 'regularized', 'leave', 'on_leave', 'work_from_home'].includes(record.attendanceStatus)) {
    throw ApiError.conflict(
      `Cannot apply work from home — attendance already marked as ${record.attendanceStatus} on this date`
    );
  }
};

const assertCanApprove = (request, actorId, actorRole) => {
  if (request.status !== 'pending') {
    throw ApiError.badRequest('Work from home request is not pending approval');
  }

  if ([SYSTEM_ROLES.OWNER, SYSTEM_ROLES.HR].includes(actorRole)) return;

  if (actorRole === SYSTEM_ROLES.MANAGER) {
    if (request.managerId && request.managerId.toString() !== actorId.toString()) {
      throw ApiError.forbidden('You are not the manager for this employee');
    }
    return;
  }

  throw ApiError.forbidden('You are not authorized to approve this work from home request');
};

const applyWfh = async (data, actorId, companyId, req) => {
  const profile = await getEmployeeProfileByUser(actorId, companyId);
  const date = getDateOnly(data.date);

  const policy = await policyEngine.getPolicyForCompany(companyId);
  if (!policy.futureSettings?.workFromHomeEnabled) {
    throw ApiError.badRequest('Work from home is not enabled for this company');
  }

  const shiftConfig = await shiftEngine.getEmployeeShift(profile._id, companyId);
  assertNotWeeklyOff(shiftConfig.workingDays, date);
  await assertNoConflicts(profile._id, companyId, date);

  const request = await wfhRequestRepository.create({
    companyId,
    employeeProfileId: profile._id,
    userId: actorId,
    managerId: profile.managerId,
    date,
    reason: data.reason || '',
    status: 'pending',
    createdBy: actorId,
    updatedBy: actorId,
  });

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: actorId,
    action: 'wfh_apply',
    entityType: 'wfh_request',
    entityId: request._id,
    metadata: { date: formatDateOnly(date) },
    req,
  });

  return formatRequest(await findDetailed(request._id, companyId));
};

const approveWfh = async (id, comment, actorId, companyId, req) => {
  const request = await wfhRequestRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!request) throw ApiError.notFound('Work from home request not found');

  const actorRole = await getActorRole(actorId);
  assertCanApprove(request, actorId, actorRole);

  const shiftConfig = await shiftEngine.getEmployeeShift(request.employeeProfileId, companyId);
  assertNotWeeklyOff(shiftConfig.workingDays, request.date);
  await assertNoConflicts(request.employeeProfileId, companyId, request.date, { excludeWfhId: id });

  const attendance = await applyWfhToAttendance({
    companyId,
    employeeProfileId: request.employeeProfileId,
    userId: request.userId,
    date: request.date,
    actorId,
  });

  await wfhRequestRepository.updateById(
    id,
    {
      status: 'approved',
      attendanceRecordId: attendance._id,
      approvedAt: new Date(),
      approvedBy: actorId,
      approvedComment: comment || null,
      updatedBy: actorId,
    },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: request.userId,
    action: 'wfh_approve',
    entityType: 'wfh_request',
    entityId: id,
    metadata: { comment },
    req,
  });

  return formatRequest(await findDetailed(id, companyId));
};

const rejectWfh = async (id, comment, actorId, companyId, req) => {
  const request = await wfhRequestRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!request) throw ApiError.notFound('Work from home request not found');

  const actorRole = await getActorRole(actorId);
  assertCanApprove(request, actorId, actorRole);

  await wfhRequestRepository.updateById(
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
    action: 'wfh_reject',
    entityType: 'wfh_request',
    entityId: id,
    metadata: { comment },
    req,
  });

  return formatRequest(await findDetailed(id, companyId));
};

const getWfh = async (id, companyId, requester) => {
  const request = await findDetailed(id, companyId);
  if (!request) throw ApiError.notFound('Work from home request not found');

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

const listWfh = async (companyId, query, requester) => {
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

  const result = await wfhRequestRepository.findWithFilters(filter, query, { companyId });
  return {
    data: result.data.map(formatRequest),
    meta: result.meta,
  };
};

module.exports = {
  applyWfh,
  approveWfh,
  rejectWfh,
  getWfh,
  listWfh,
  formatRequest,
};
