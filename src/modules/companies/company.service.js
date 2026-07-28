const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const companyRepository = require('./company.repository');

const formatCompany = (c) => ({
  id: c._id,
  companyName: c.companyName,
  companyCode: c.companyCode,
  email: c.email,
  phone: c.phone,
  address: c.address,
  logo: c.logo,
  status: c.status,
  createdBy: c.createdBy,
  updatedBy: c.updatedBy,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const createCompany = async (data, actorId, req) => {
  const exists = await companyRepository.findOne({ companyCode: data.companyCode.toUpperCase() });
  if (exists) throw ApiError.conflict('Company code already exists');

  const company = await companyRepository.create({
    ...data,
    companyCode: data.companyCode.toUpperCase(),
    status: 'active',
    createdBy: actorId,
    updatedBy: actorId,
  });

  await createAuditLog({
    userId: actorId,
    action: 'create',
    entityType: 'company',
    entityId: company._id,
    changes: { after: formatCompany(company) },
    req,
  });

  return formatCompany(company);
};

const updateCompany = async (id, data, actorId, req) => {
  const company = await companyRepository.findById(id);
  if (!company) throw ApiError.notFound('Company not found');

  if (data.companyCode && data.companyCode !== company.companyCode) {
    const exists = await companyRepository.findOne({ companyCode: data.companyCode.toUpperCase() });
    if (exists) throw ApiError.conflict('Company code already exists');
  }

  const updated = await companyRepository.updateById(id, {
    ...data,
    ...(data.companyCode && { companyCode: data.companyCode.toUpperCase() }),
    updatedBy: actorId,
  });

  await createAuditLog({
    companyId: id,
    userId: actorId,
    action: 'update',
    entityType: 'company',
    entityId: id,
    changes: { before: formatCompany(company), after: formatCompany(updated) },
    req,
  });

  return formatCompany(updated);
};

const getCompany = async (id) => {
  const company = await companyRepository.findById(id);
  if (!company) throw ApiError.notFound('Company not found');
  return formatCompany(company);
};

const listCompanies = async (query = {}) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { companyName: { $regex: query.search, $options: 'i' } },
      { companyCode: { $regex: query.search, $options: 'i' } },
    ];
  }
  const result = await companyRepository.findMany(filter, query);
  return { data: result.data.map(formatCompany), meta: result.meta };
};

const deleteCompany = async (id, actorId, req) => {
  const company = await companyRepository.findById(id);
  if (!company) throw ApiError.notFound('Company not found');

  await companyRepository.deleteById(id);

  await createAuditLog({
    userId: actorId,
    action: 'delete',
    entityType: 'company',
    entityId: id,
    changes: { before: formatCompany(company) },
    req,
  });
};

const setCompanyStatus = async (id, status, actorId, req) => {
  const company = await companyRepository.findById(id);
  if (!company) throw ApiError.notFound('Company not found');

  const updated = await companyRepository.updateById(id, { status, updatedBy: actorId });

  await createAuditLog({
    companyId: id,
    userId: actorId,
    action: status === 'active' ? 'activate' : 'update',
    entityType: 'company',
    entityId: id,
    changes: { before: { status: company.status }, after: { status } },
    req,
  });

  return formatCompany(updated);
};

module.exports = {
  createCompany,
  updateCompany,
  getCompany,
  listCompanies,
  deleteCompany,
  activateCompany: (id, actorId, req) => setCompanyStatus(id, 'active', actorId, req),
  deactivateCompany: (id, actorId, req) => setCompanyStatus(id, 'inactive', actorId, req),
};
