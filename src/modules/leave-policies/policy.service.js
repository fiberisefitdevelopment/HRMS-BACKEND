const policyRepository = require('./policy.repository');
const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');

const formatPolicy = (p) => ({
  id: p._id,
  companyId: p.companyId,
  name: p.name,
  isDefault: p.isDefault,
  leaveTypes: p.leaveTypes,
  shortLeave: p.shortLeave,
  approvalWorkflow: p.approvalWorkflow,
  workingDaysForLeave: p.workingDaysForLeave,
  holidays: p.holidays,
  status: p.status,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const getPolicy = async (companyId) => {
  const policy = await policyRepository.findDefault(companyId);
  if (!policy) throw ApiError.notFound('Leave policy not found for this company');
  return formatPolicy(policy);
};

const updatePolicy = async (data, companyId, actorId, req) => {
  const policy = await policyRepository.findDefault(companyId);
  if (!policy) throw ApiError.notFound('Leave policy not found');

  const updated = await policyRepository.updateById(
    policy._id,
    { ...data, updatedBy: actorId },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'leave_policy',
    entityId: policy._id,
    changes: { after: formatPolicy(updated) },
    req,
  });

  return formatPolicy(updated);
};

const getLeaveTypeConfig = async (companyId, leaveTypeCode) => {
  const policy = await policyRepository.findDefault(companyId);
  if (!policy) throw ApiError.notFound('Leave policy not found');
  const config = policy.leaveTypes.find((lt) => lt.code === leaveTypeCode.toUpperCase());
  if (!config || !config.isActive) throw ApiError.badRequest(`Leave type ${leaveTypeCode} is not configured`);
  return { policy, config };
};

module.exports = { getPolicy, updatePolicy, getLeaveTypeConfig, formatPolicy };
