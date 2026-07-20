const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const designationService = require('./designation.service');

const create = catchAsync(async (req, res) => {
  const data = await designationService.createDesignation(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Designation created', data });
});

const update = catchAsync(async (req, res) => {
  const data = await designationService.updateDesignation(
    req.params.id,
    req.body,
    req.companyId,
    req.user.id,
    req
  );
  sendSuccess(res, { message: 'Designation updated', data });
});

const getById = catchAsync(async (req, res) => {
  const data = await designationService.getDesignation(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Designation retrieved', data });
});

const list = catchAsync(async (req, res) => {
  const { data, meta } = await designationService.listDesignations(req.companyId, req.query);
  sendSuccess(res, { message: 'Designations retrieved', data, meta });
});

const remove = catchAsync(async (req, res) => {
  await designationService.deleteDesignation(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Designation deleted' });
});

module.exports = { create, update, getById, list, remove };
