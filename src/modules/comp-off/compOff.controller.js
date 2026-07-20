const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const compOffService = require('./compOff.service');

const eligibility = catchAsync(async (req, res) => {
  const data = await compOffService.getEligibility(req.user.id, req.companyId, req.query.date);
  sendSuccess(res, { message: 'Comp-off eligibility retrieved', data });
});

const raise = catchAsync(async (req, res) => {
  const data = await compOffService.raiseCompOff(req.body, req.user.id, req.companyId, req);
  sendCreated(res, { message: 'Comp-off request submitted', data });
});

const list = catchAsync(async (req, res) => {
  const result = await compOffService.listCompOff(req.companyId, req.query, req.user);
  sendSuccess(res, { message: 'Comp-off requests retrieved', data: result.data, meta: result.meta });
});

const getById = catchAsync(async (req, res) => {
  const data = await compOffService.getCompOff(req.params.id, req.companyId, req.user);
  sendSuccess(res, { message: 'Comp-off request retrieved', data });
});

const cancel = catchAsync(async (req, res) => {
  const data = await compOffService.cancelCompOff(
    req.params.id,
    req.body.reason,
    req.user.id,
    req.companyId,
    req
  );
  sendSuccess(res, { message: 'Comp-off request cancelled', data });
});

const approve = catchAsync(async (req, res) => {
  const data = await compOffService.approveCompOff(
    req.params.id,
    req.body.comment,
    req.user.id,
    req.companyId,
    req
  );
  sendSuccess(res, { message: 'Comp-off request approved', data });
});

const reject = catchAsync(async (req, res) => {
  const data = await compOffService.rejectCompOff(
    req.params.id,
    req.body.comment,
    req.user.id,
    req.companyId,
    req
  );
  sendSuccess(res, { message: 'Comp-off request rejected', data });
});

module.exports = {
  eligibility,
  raise,
  list,
  getById,
  cancel,
  approve,
  reject,
};
