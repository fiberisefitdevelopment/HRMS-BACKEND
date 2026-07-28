const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const roleService = require('./role.service');

const getRoles = catchAsync(async (req, res) => {
  const roles = await roleService.getAllRoles();
  sendSuccess(res, { message: 'Roles retrieved', data: roles });
});

module.exports = { getRoles };
