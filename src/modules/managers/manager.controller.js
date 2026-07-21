const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const managerService = require('./manager.service');

const assign = catchAsync(async (req, res) => {
  const data = await managerService.assignManager(
    req.body.employeeProfileId,
    req.body.managerId,
    req.companyId,
    req.user.id,
    req
  );
  sendSuccess(res, { message: 'Manager assigned', data });
});

const change = catchAsync(async (req, res) => {
  const data = await managerService.changeManager(
    req.body.employeeProfileId,
    req.body.managerId,
    req.companyId,
    req.user.id,
    req
  );
  sendSuccess(res, { message: 'Manager changed', data });
});

const remove = catchAsync(async (req, res) => {
  const data = await managerService.removeManager(
    req.body.employeeProfileId,
    req.companyId,
    req.user.id,
    req
  );
  sendSuccess(res, { message: 'Manager removed', data });
});

const getTeam = catchAsync(async (req, res) => {
  const managerId = req.params.managerId || req.user.id;
  const result = await managerService.getTeamMembers(managerId, req.companyId, req.query, req.user);
  sendSuccess(res, { message: 'Team members retrieved', data: result.data, meta: result.meta });
});

const getTeamOverview = catchAsync(async (req, res) => {
  const managerId = req.query.managerId || req.user.id;
  const data = await managerService.getTeamOverview(managerId, req.companyId, req.user);
  sendSuccess(res, { message: 'Team overview retrieved', data });
});

const getTeamAttendance = catchAsync(async (req, res) => {
  const managerId = req.query.managerId || req.user.id;
  const data = await managerService.getTeamAttendance(managerId, req.companyId, req.query, req.user);
  sendSuccess(res, { message: 'Team attendance retrieved', data });
});

module.exports = { assign, change, remove, getTeam, getTeamOverview, getTeamAttendance };
