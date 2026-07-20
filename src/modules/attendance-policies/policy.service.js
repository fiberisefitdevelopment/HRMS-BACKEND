const policyRepository = require('./policy.repository');
const ApiError = require('../../utils/ApiError');

const formatGeofencing = (geofencing) => {
  const g = geofencing || {};
  return {
    enabled: g.enabled ?? false,
    enforceOnPunchIn: g.enforceOnPunchIn !== false,
    enforceOnPunchOut: g.enforceOnPunchOut !== false,
    applyToAllEmployees: g.applyToAllEmployees !== false,
    employeeProfileIds: (g.employeeProfileIds || []).map((id) => String(id)),
  };
};

const formatPolicy = (p) => ({
  id: p._id,
  companyId: p.companyId,
  name: p.name,
  isDefault: p.isDefault,
  officeTimings: p.officeTimings,
  workingDays: p.workingDays,
  gracePeriodMinutes: p.gracePeriodMinutes,
  regularization: p.regularization,
  dailyWageBuffer: p.dailyWageBuffer,
  workingHours: p.workingHours,
  breaks: p.breaks,
  latePolicy: p.latePolicy,
  missingPunchRules: p.missingPunchRules,
  autoPunchOut: p.autoPunchOut,
  futureSettings: p.futureSettings,
  geofencing: formatGeofencing(p.geofencing),
  status: p.status,
});

const getPolicy = async (companyId) => {
  const policy = await policyRepository.findDefault(companyId);
  if (!policy) throw ApiError.notFound('Attendance policy not found');
  return formatPolicy(policy);
};

const updatePolicy = async (data, companyId, actorId) => {
  const policy = await policyRepository.findDefault(companyId);
  if (!policy) throw ApiError.notFound('Attendance policy not found');

  const payload = { ...data, updatedBy: actorId };
  if (data.geofencing) {
    const current = formatGeofencing(policy.geofencing);
    payload.geofencing = {
      enabled: data.geofencing.enabled ?? current.enabled,
      enforceOnPunchIn: data.geofencing.enforceOnPunchIn ?? current.enforceOnPunchIn,
      enforceOnPunchOut: data.geofencing.enforceOnPunchOut ?? current.enforceOnPunchOut,
      applyToAllEmployees:
        data.geofencing.applyToAllEmployees ?? current.applyToAllEmployees,
      employeeProfileIds:
        data.geofencing.employeeProfileIds !== undefined
          ? data.geofencing.employeeProfileIds
          : current.employeeProfileIds,
    };
  }

  const updated = await policyRepository.updateById(policy._id, payload, { companyId });
  return formatPolicy(updated);
};

module.exports = { getPolicy, updatePolicy, formatPolicy, formatGeofencing };
