const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { RULE_PRIORITY_ORDER } = require('../../constants');
const policyRepository = require('./policy.repository');
const PolicyVersion = require('./policyVersion.model');

const formatPolicy = (p) => ({
  id: p._id,
  companyId: p.companyId,
  name: p.name,
  policyType: p.policyType,
  description: p.description,
  version: p.version,
  status: p.status,
  isDefault: p.isDefault,
  config: p.config,
  assignedDepartmentIds: p.assignedDepartmentIds,
  assignedEmployeeProfileIds: p.assignedEmployeeProfileIds,
  effectiveFrom: p.effectiveFrom,
  effectiveTo: p.effectiveTo,
  publishedAt: p.publishedAt,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

const createPolicy = async (data, companyId, actorId, req) => {
  const policy = await policyRepository.create({
    ...data,
    companyId,
    createdBy: actorId,
    updatedBy: actorId,
  });

  await PolicyVersion.create({
    policyId: policy._id,
    companyId,
    version: 1,
    status: 'draft',
    config: data.config || {},
    createdBy: actorId,
  });

  await createAuditLog({ companyId, userId: actorId, action: 'create', entityType: 'policy', entityId: policy._id, req });
  return formatPolicy(policy);
};

const updatePolicy = async (id, data, companyId, actorId, req) => {
  const policy = await policyRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!policy) throw ApiError.notFound('Policy not found');
  if (policy.status === 'published') throw ApiError.badRequest('Published policy cannot be edited directly — create new version');

  const updated = await policyRepository.updateById(id, { ...data, updatedBy: actorId }, { companyId });
  await createAuditLog({ companyId, userId: actorId, action: 'update', entityType: 'policy', entityId: id, req });
  return formatPolicy(updated);
};

const publishPolicy = async (id, companyId, actorId, req) => {
  const policy = await policyRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!policy) throw ApiError.notFound('Policy not found');

  const newVersion = policy.version + 1;
  await PolicyVersion.create({
    policyId: policy._id,
    companyId,
    version: newVersion,
    status: 'published',
    config: policy.config,
    publishedAt: new Date(),
    publishedBy: actorId,
    createdBy: actorId,
  });

  if (policy.isDefault) {
    await policyRepository.model.updateMany(
      { companyId, policyType: policy.policyType, isDefault: true, _id: { $ne: id } },
      { status: 'archived' },
      { companyId }
    );
  }

  const updated = await policyRepository.updateById(
    id,
    { status: 'published', version: newVersion, publishedAt: new Date(), publishedBy: actorId },
    { companyId }
  );

  await createAuditLog({ companyId, userId: actorId, action: 'rule_publish', entityType: 'policy', entityId: id, req });
  return formatPolicy(updated);
};

const archivePolicy = async (id, companyId, actorId, req) => {
  const updated = await policyRepository.updateById(id, { status: 'archived' }, { companyId });
  if (!updated) throw ApiError.notFound('Policy not found');
  await createAuditLog({ companyId, userId: actorId, action: 'update', entityType: 'policy', entityId: id, metadata: { archived: true }, req });
  return formatPolicy(updated);
};

const clonePolicy = async (id, companyId, actorId, req) => {
  const source = await policyRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!source) throw ApiError.notFound('Policy not found');

  const cloned = await policyRepository.create({
    companyId,
    name: `${source.name} (Copy)`,
    policyType: source.policyType,
    description: source.description,
    config: source.config,
    status: 'draft',
    isDefault: false,
    clonedFromId: source._id,
    createdBy: actorId,
    updatedBy: actorId,
  });

  return formatPolicy(cloned);
};

const getPolicy = async (id, companyId) => {
  const policy = await policyRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!policy) throw ApiError.notFound('Policy not found');
  const versions = await PolicyVersion.find({ policyId: id, companyId }, null, { companyId }).sort({ version: -1 });
  return { ...formatPolicy(policy), versions };
};

const listPolicies = async (companyId, query) => {
  const filter = { companyId };
  if (query.policyType) filter.policyType = query.policyType;
  if (query.status) filter.status = query.status;
  const result = await policyRepository.findMany(filter, query, { companyId });
  return { data: result.data.map(formatPolicy), meta: result.meta };
};

const rollbackPolicy = async (id, version, companyId, actorId, req) => {
  const policy = await policyRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!policy) throw ApiError.notFound('Policy not found');

  const versionDoc = await PolicyVersion.findOne({ policyId: id, companyId, version }, null, { companyId });
  if (!versionDoc) throw ApiError.notFound('Policy version not found');

  const updated = await policyRepository.updateById(
    id,
    { config: versionDoc.config, version, updatedBy: actorId },
    { companyId }
  );

  await createAuditLog({ companyId, userId: actorId, action: 'update', entityType: 'policy', entityId: id, metadata: { rollbackTo: version }, req });
  return formatPolicy(updated);
};

module.exports = {
  createPolicy,
  updatePolicy,
  publishPolicy,
  archivePolicy,
  clonePolicy,
  getPolicy,
  listPolicies,
  rollbackPolicy,
  formatPolicy,
};
