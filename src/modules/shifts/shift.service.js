const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { notifyShiftAssigned } = require('../../helpers/notification');
const shiftRepository = require('./shift.repository');
const policyRepository = require('../attendance-policies/policy.repository');
const EmployeeShiftAssignment = require('./employeeShiftAssignment.model');
const AttendanceRecord = require('../attendance/attendanceRecord.model');

const formatShift = (s) => ({
  id: s._id,
  companyId: s.companyId,
  policyId: s.policyId,
  name: s.name,
  code: s.code,
  startTime: s.startTime,
  endTime: s.endTime,
  workingDays: s.workingDays,
  breakTimings: s.breakTimings,
  gracePeriodMinutes: s.gracePeriodMinutes,
  status: s.status,
});

const createShift = async (data, companyId, actorId, req) => {
  const exists = await shiftRepository.findByCode(companyId, data.code);
  if (exists) throw ApiError.conflict('Shift code already exists');

  const policy = data.policyId
    ? await policyRepository.findById(data.policyId, null, { companyId })
    : await policyRepository.findDefault(companyId);

  const shift = await shiftRepository.create({
    ...data,
    code: data.code.toUpperCase(),
    companyId,
    policyId: policy?._id,
    createdBy: actorId,
    updatedBy: actorId,
  });

  await createAuditLog({ companyId, userId: actorId, action: 'create', entityType: 'shift', entityId: shift._id, req });
  return formatShift(shift);
};

const updateShift = async (id, data, companyId, actorId, req) => {
  const shift = await shiftRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!shift) throw ApiError.notFound('Shift not found');

  const updated = await shiftRepository.updateById(id, { ...data, updatedBy: actorId }, { companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'update', entityType: 'shift', entityId: id, req });
  return formatShift(updated);
};

const deleteShift = async (id, companyId, actorId, req) => {
  const shift = await shiftRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!shift) throw ApiError.notFound('Shift not found');
  await shiftRepository.updateById(id, { status: 'inactive' }, { companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'delete', entityType: 'shift', entityId: id, req });
};

const listShifts = async (companyId, query) => {
  const filter = { companyId };
  if (query.status) filter.status = query.status;
  const result = await shiftRepository.findMany(filter, query, { companyId });
  return { data: result.data.map(formatShift), meta: result.meta };
};

const assignShift = async ({ employeeProfileId, userId, shiftId }, companyId, actorId, req) => {
  const shift = await shiftRepository.findOne({ _id: shiftId, companyId, status: 'active' }, null, { companyId });
  if (!shift) throw ApiError.notFound('Shift not found');

  await EmployeeShiftAssignment.updateMany(
    { employeeProfileId, companyId, isActive: true },
    { isActive: false },
    { companyId }
  );

  const assignment = await EmployeeShiftAssignment.create({
    companyId,
    employeeProfileId,
    userId,
    shiftId,
    assignedBy: actorId,
    isActive: true,
  });

  await AttendanceRecord.updateMany(
    {
      companyId,
      employeeProfileId,
      $or: [{ shiftId: null }, { shiftId: { $exists: false } }],
    },
    { $set: { shiftId } },
    { companyId }
  );

  await notifyShiftAssigned(companyId, userId, {
    id: shift._id,
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
  });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'shift_assignment',
    entityId: assignment._id,
    metadata: { shiftId, employeeProfileId },
    req,
  });

  return assignment;
};

const removeShiftAssignment = async (employeeProfileId, companyId, actorId, req) => {
  await EmployeeShiftAssignment.updateMany(
    { employeeProfileId, companyId, isActive: true },
    { isActive: false },
    { companyId }
  );
  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'delete',
    entityType: 'shift_assignment',
    metadata: { employeeProfileId },
    req,
  });
};

module.exports = {
  createShift,
  updateShift,
  deleteShift,
  listShifts,
  getShift: async (id, companyId) => {
    const s = await shiftRepository.findOne({ _id: id, companyId }, null, { companyId });
    if (!s) throw ApiError.notFound('Shift not found');
    return formatShift(s);
  },
  assignShift,
  removeShiftAssignment,
};
