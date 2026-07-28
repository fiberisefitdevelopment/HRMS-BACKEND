const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const shiftService = require('./shift.service');

const create = catchAsync(async (req, res) => {
  const data = await shiftService.createShift(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Shift created', data });
});

const update = catchAsync(async (req, res) => {
  const data = await shiftService.updateShift(req.params.id, req.body, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Shift updated', data });
});

const remove = catchAsync(async (req, res) => {
  await shiftService.deleteShift(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Shift deleted' });
});

const list = catchAsync(async (req, res) => {
  const { data, meta } = await shiftService.listShifts(req.companyId, req.query);
  sendSuccess(res, { message: 'Shifts retrieved', data, meta });
});

const getById = catchAsync(async (req, res) => {
  const data = await shiftService.getShift(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Shift retrieved', data });
});

const assign = catchAsync(async (req, res) => {
  const data = await shiftService.assignShift(req.body, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Shift assigned', data });
});

const unassign = catchAsync(async (req, res) => {
  await shiftService.removeShiftAssignment(req.body.employeeProfileId, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Shift assignment removed' });
});

module.exports = { create, update, remove, list, getById, assign, unassign };
