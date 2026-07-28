const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const regularizationService = require('./regularization.service');

const eligibility = catchAsync(async (req, res) => {
  const data = await regularizationService.getEligibility(
    req.user.id,
    req.companyId,
    req.query.date
  );
  sendSuccess(res, { message: 'Regularization eligibility retrieved', data });
});

const raise = catchAsync(async (req, res) => {
  const data = await regularizationService.raiseRegularization(
    req.body,
    req.user.id,
    req.companyId,
    req
  );
  sendCreated(res, { message: 'Regularization applied and auto-approved', data });
});

const list = catchAsync(async (req, res) => {
  const result = await regularizationService.listRegularization(
    req.companyId,
    req.query,
    req.user
  );
  sendSuccess(res, {
    message: 'Regularization requests retrieved',
    data: result.data,
    meta: result.meta,
  });
});

const getById = catchAsync(async (req, res) => {
  const data = await regularizationService.getRegularization(
    req.params.id,
    req.companyId,
    req.user
  );
  sendSuccess(res, { message: 'Regularization request retrieved', data });
});

module.exports = {
  eligibility,
  raise,
  list,
  getById,
};
