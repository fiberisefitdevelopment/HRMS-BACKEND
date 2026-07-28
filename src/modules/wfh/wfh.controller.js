const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const wfhService = require('./wfh.service');

const apply = catchAsync(async (req, res) => {
  const data = await wfhService.applyWfh(req.body, req.user.id, req.companyId, req);
  sendCreated(res, { message: 'Work from home request submitted for manager approval', data });
});

const approve = catchAsync(async (req, res) => {
  const data = await wfhService.approveWfh(
    req.params.id,
    req.body.comment,
    req.user.id,
    req.companyId,
    req
  );
  sendSuccess(res, { message: 'Work from home request approved', data });
});

const reject = catchAsync(async (req, res) => {
  const data = await wfhService.rejectWfh(
    req.params.id,
    req.body.comment,
    req.user.id,
    req.companyId,
    req
  );
  sendSuccess(res, { message: 'Work from home request rejected', data });
});

const list = catchAsync(async (req, res) => {
  const result = await wfhService.listWfh(req.companyId, req.query, req.user);
  sendSuccess(res, {
    message: 'Work from home requests retrieved',
    data: result.data,
    meta: result.meta,
  });
});

const getById = catchAsync(async (req, res) => {
  const data = await wfhService.getWfh(req.params.id, req.companyId, req.user);
  sendSuccess(res, { message: 'Work from home request retrieved', data });
});

module.exports = {
  apply,
  approve,
  reject,
  list,
  getById,
};
