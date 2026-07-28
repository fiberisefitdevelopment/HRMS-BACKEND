const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const designationRepository = require('./designation.repository');

const formatDesignation = (d) => ({
  id: d._id,
  companyId: d.companyId,
  name: d.name,
  code: d.code,
  level: d.level,
  description: d.description,
  isActive: d.isActive,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const createDesignation = async (data, companyId, actorId, req) => {
  const exists = await designationRepository.findOne(
    { companyId, code: data.code.toUpperCase() },
    null,
    { companyId }
  );
  if (exists) throw ApiError.conflict('Designation code already exists in this company');

  const designation = await designationRepository.create({
    ...data,
    code: data.code.toUpperCase(),
    companyId,
  });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'create',
    entityType: 'designation',
    entityId: designation._id,
    changes: { after: formatDesignation(designation) },
    req,
  });

  return formatDesignation(designation);
};

const updateDesignation = async (id, data, companyId, actorId, req) => {
  const designation = await designationRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!designation) throw ApiError.notFound('Designation not found');

  if (data.code) {
    const exists = await designationRepository.findOne(
      { companyId, code: data.code.toUpperCase(), _id: { $ne: id } },
      null,
      { companyId }
    );
    if (exists) throw ApiError.conflict('Designation code already exists');
  }

  const updated = await designationRepository.updateById(
    id,
    { ...data, ...(data.code && { code: data.code.toUpperCase() }) },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'designation',
    entityId: id,
    changes: { before: formatDesignation(designation), after: formatDesignation(updated) },
    req,
  });

  return formatDesignation(updated);
};

const getDesignation = async (id, companyId) => {
  const designation = await designationRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!designation) throw ApiError.notFound('Designation not found');
  return formatDesignation(designation);
};

const listDesignations = async (companyId, query = {}) => {
  const filter = { companyId };
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { code: { $regex: query.search, $options: 'i' } },
    ];
  }
  const result = await designationRepository.findMany(filter, query, { companyId });
  return { data: result.data.map(formatDesignation), meta: result.meta };
};

const deleteDesignation = async (id, companyId, actorId, req) => {
  const designation = await designationRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!designation) throw ApiError.notFound('Designation not found');

  await designationRepository.updateById(id, { isActive: false }, { companyId });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'delete',
    entityType: 'designation',
    entityId: id,
    req,
  });
};

const findOrCreateByName = async (name, companyId) => {
  let designation = await designationRepository.findOne(
    { companyId, name: { $regex: new RegExp(`^${name}$`, 'i') } },
    null,
    { companyId }
  );
  if (designation) return designation;

  const code = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 10)
    .toUpperCase() || 'DESG';

  let uniqueCode = code;
  let counter = 1;
  while (await designationRepository.exists({ companyId, code: uniqueCode }, { companyId })) {
    uniqueCode = `${code}${counter++}`;
  }

  return designationRepository.create({ companyId, name, code: uniqueCode, isActive: true });
};

module.exports = {
  createDesignation,
  updateDesignation,
  getDesignation,
  listDesignations,
  deleteDesignation,
  findOrCreateByName,
};
