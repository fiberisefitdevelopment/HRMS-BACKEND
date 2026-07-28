const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const departmentRepository = require('./department.repository');

const formatDepartment = (d) => ({
  id: d._id,
  companyId: d.companyId,
  name: d.name,
  code: d.code,
  description: d.description,
  parentDepartmentId: d.parentDepartmentId,
  headEmployeeId: d.headEmployeeId,
  isActive: d.isActive,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

const createDepartment = async (data, companyId, actorId, req) => {
  const exists = await departmentRepository.findOne(
    { companyId, code: data.code.toUpperCase() },
    null,
    { companyId }
  );
  if (exists) throw ApiError.conflict('Department code already exists in this company');

  const dept = await departmentRepository.create({
    ...data,
    code: data.code.toUpperCase(),
    companyId,
  });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'create',
    entityType: 'department',
    entityId: dept._id,
    changes: { after: formatDepartment(dept) },
    req,
  });

  return formatDepartment(dept);
};

const updateDepartment = async (id, data, companyId, actorId, req) => {
  const dept = await departmentRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!dept) throw ApiError.notFound('Department not found');

  if (data.code) {
    const exists = await departmentRepository.findOne(
      { companyId, code: data.code.toUpperCase(), _id: { $ne: id } },
      null,
      { companyId }
    );
    if (exists) throw ApiError.conflict('Department code already exists');
  }

  const updated = await departmentRepository.updateById(
    id,
    { ...data, ...(data.code && { code: data.code.toUpperCase() }) },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'department',
    entityId: id,
    changes: { before: formatDepartment(dept), after: formatDepartment(updated) },
    req,
  });

  return formatDepartment(updated);
};

const getDepartment = async (id, companyId) => {
  const dept = await departmentRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!dept) throw ApiError.notFound('Department not found');
  return formatDepartment(dept);
};

const listDepartments = async (companyId, query = {}) => {
  const filter = { companyId };
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { code: { $regex: query.search, $options: 'i' } },
    ];
  }
  const result = await departmentRepository.findMany(filter, query, { companyId });
  return { data: result.data.map(formatDepartment), meta: result.meta };
};

const deleteDepartment = async (id, companyId, actorId, req) => {
  const dept = await departmentRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!dept) throw ApiError.notFound('Department not found');

  await departmentRepository.updateById(id, { isActive: false }, { companyId });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'delete',
    entityType: 'department',
    entityId: id,
    req,
  });
};

const findOrCreateByName = async (name, companyId) => {
  let dept = await departmentRepository.findOne(
    { companyId, name: { $regex: new RegExp(`^${name}$`, 'i') } },
    null,
    { companyId }
  );
  if (dept) return dept;

  const code = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 10)
    .toUpperCase() || 'DEPT';

  let uniqueCode = code;
  let counter = 1;
  while (await departmentRepository.exists({ companyId, code: uniqueCode }, { companyId })) {
    uniqueCode = `${code}${counter++}`;
  }

  return departmentRepository.create({ companyId, name, code: uniqueCode, isActive: true });
};

module.exports = {
  createDepartment,
  updateDepartment,
  getDepartment,
  listDepartments,
  deleteDepartment,
  findOrCreateByName,
};
