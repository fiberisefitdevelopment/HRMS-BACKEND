const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const companyService = require('./company.service');

const create = catchAsync(async (req, res) => {
  const data = await companyService.createCompany(req.body, req.user.id, req);
  sendCreated(res, { message: 'Company created', data });
});

const update = catchAsync(async (req, res) => {
  const data = await companyService.updateCompany(req.params.id, req.body, req.user.id, req);
  sendSuccess(res, { message: 'Company updated', data });
});

const getById = catchAsync(async (req, res) => {
  const data = await companyService.getCompany(req.params.id);
  sendSuccess(res, { message: 'Company retrieved', data });
});

const list = catchAsync(async (req, res) => {
  const { data, meta } = await companyService.listCompanies(req.query);
  sendSuccess(res, { message: 'Companies retrieved', data, meta });
});

const remove = catchAsync(async (req, res) => {
  await companyService.deleteCompany(req.params.id, req.user.id, req);
  sendSuccess(res, { message: 'Company deleted' });
});

const activate = catchAsync(async (req, res) => {
  const data = await companyService.activateCompany(req.params.id, req.user.id, req);
  sendSuccess(res, { message: 'Company activated', data });
});

const deactivate = catchAsync(async (req, res) => {
  const data = await companyService.deactivateCompany(req.params.id, req.user.id, req);
  sendSuccess(res, { message: 'Company deactivated', data });
});

module.exports = { create, update, getById, list, remove, activate, deactivate };
