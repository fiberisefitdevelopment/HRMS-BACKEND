const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const policyService = require('./policy.service');

const getPolicy = catchAsync(async (req, res) => {
  const data = await policyService.getPolicy(req.companyId);
  sendSuccess(res, { message: 'Leave policy retrieved', data });
});

const updatePolicy = catchAsync(async (req, res) => {
  const data = await policyService.updatePolicy(req.body, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Leave policy updated', data });
});

module.exports = { getPolicy, updatePolicy };
