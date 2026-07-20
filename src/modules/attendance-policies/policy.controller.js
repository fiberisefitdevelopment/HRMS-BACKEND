const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const policyService = require('./policy.service');

const get = catchAsync(async (req, res) => {
  const data = await policyService.getPolicy(req.companyId);
  sendSuccess(res, { message: 'Attendance policy retrieved', data });
});

const update = catchAsync(async (req, res) => {
  const data = await policyService.updatePolicy(req.body, req.companyId, req.user.id);
  sendSuccess(res, { message: 'Attendance policy updated', data });
});

module.exports = { get, update };
