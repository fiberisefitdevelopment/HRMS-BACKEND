const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const departmentService = require('./department.service');

const create = catchAsync(async (req, res) => {
  const data = await departmentService.createDepartment(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Department created', data });
});

const update = catchAsync(async (req, res) => {
  const data = await departmentService.updateDepartment(
    req.params.id,
    req.body,
    req.companyId,
    req.user.id,
    req
  );
  sendSuccess(res, { message: 'Department updated', data });
});

const getById = catchAsync(async (req, res) => {
  const data = await departmentService.getDepartment(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Department retrieved', data });
});

const list = catchAsync(async (req, res) => {
  const { data, meta } = await departmentService.listDepartments(req.companyId, req.query);
  sendSuccess(res, { message: 'Departments retrieved', data, meta });
});

const remove = catchAsync(async (req, res) => {
  await departmentService.deleteDepartment(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Department deleted' });
});

module.exports = { create, update, getById, list, remove };
