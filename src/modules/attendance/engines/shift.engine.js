const EmployeeShiftAssignment = require('../../shifts/employeeShiftAssignment.model');
const Shift = require('../../shifts/shift.model');
const { getDateOnly } = require('../../../utils/time');
const policyEngine = require('./policy.engine');
const ApiError = require('../../../utils/ApiError');

const getEmployeeShift = async (employeeProfileId, companyId) => {
  const assignment = await EmployeeShiftAssignment.findOne(
    { employeeProfileId, companyId, isActive: true },
    null,
    { companyId }
  ).populate('shiftId');

  if (!assignment?.shiftId) {
    throw ApiError.badRequest('No shift assigned to employee');
  }

  const policy = await policyEngine.getPolicyForCompany(companyId);
  return policyEngine.mergeShiftWithPolicy(assignment.shiftId, policy);
};

const isWorkingDay = (shiftConfig, date = new Date()) => {
  const dayIndex = getDateOnly(date).getDay();
  return shiftConfig.workingDays.includes(dayIndex);
};

const getShiftEndDateTime = (date, shiftConfig) => {
  const { combineDateAndMinutes } = require('../../../utils/time');
  return combineDateAndMinutes(date, shiftConfig.shiftEndMinutes);
};

const formatShiftRef = (shiftDoc) => {
  if (!shiftDoc) return null;
  const id = shiftDoc._id || shiftDoc.id;
  if (!id) return null;
  return {
    id,
    name: shiftDoc.name,
    code: shiftDoc.code,
    startTime: shiftDoc.startTime,
    endTime: shiftDoc.endTime,
  };
};

const getActiveShiftAssignment = async (employeeProfileId, companyId) =>
  EmployeeShiftAssignment.findOne(
    { employeeProfileId, companyId, isActive: true },
    null,
    { companyId }
  ).populate('shiftId', 'name code startTime endTime');

module.exports = {
  getEmployeeShift,
  getActiveShiftAssignment,
  formatShiftRef,
  isWorkingDay,
  getShiftEndDateTime,
};
