const CompanyAttendancePolicy = require('../../attendance-policies/companyAttendancePolicy.model');
const ApiError = require('../../../utils/ApiError');

const getPolicyForCompany = async (companyId) => {
  const policy = await CompanyAttendancePolicy.findOne(
    { companyId, isDefault: true, status: 'active' },
    null,
    { companyId }
  );
  if (!policy) {
    throw ApiError.notFound('Attendance policy not configured for this company');
  }
  return policy;
};

const getPolicyById = async (policyId, companyId) => {
  const policy = await CompanyAttendancePolicy.findOne({ _id: policyId, companyId }, null, { companyId });
  if (!policy) throw ApiError.notFound('Attendance policy not found');
  return policy;
};

const { parseTimeToMinutes } = require('../../../utils/time');

const mergeShiftWithPolicy = (shift, policy) => ({
  policy,
  shift,
  shiftStartMinutes: parseTimeToMinutes(shift.startTime),
  shiftEndMinutes: parseTimeToMinutes(shift.endTime),
  workingDays: shift.workingDays?.length ? shift.workingDays : policy.workingDays,
  gracePeriodMinutes: shift.gracePeriodMinutes ?? policy.gracePeriodMinutes,
  breakRules: shift.breakTimings?.length ? shift.breakTimings : policy.breaks?.rules || [],
  fullDayMinutes: policy.workingHours?.fullDayMinutes ?? 510,
  halfDayMinutes: policy.workingHours?.halfDayMinutes ?? 270,
  regularization: policy.regularization,
  dailyWageBuffer: policy.dailyWageBuffer,
  latePolicy: policy.latePolicy,
  missingPunchRules: policy.missingPunchRules,
  autoPunchOut: policy.autoPunchOut,
  geofencing: policy.geofencing || {
    enabled: false,
    enforceOnPunchIn: true,
    enforceOnPunchOut: true,
    applyToAllEmployees: true,
    employeeProfileIds: [],
  },
});

module.exports = {
  getPolicyForCompany,
  getPolicyById,
  mergeShiftWithPolicy,
};
