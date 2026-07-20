const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const permissionService = require('./permission.service');

const getPermissions = catchAsync(async (req, res) => {
  const permissions = await permissionService.getAllPermissions();
  sendSuccess(res, { message: 'Permissions retrieved', data: permissions });
});

module.exports = { getPermissions };
