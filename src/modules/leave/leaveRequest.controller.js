const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const leaveService = require('./leaveRequest.service');
const reportService = require('./report.service');
const exportService = require('./export.service');
const calendarService = require('./calendar.service');

const apply = catchAsync(async (req, res) => {
  const data = await leaveService.applyLeave(req.body, req.user.id, req.companyId, req);
  const isManual = data.source === 'manual_hr';
  sendCreated(res, {
    message: isManual ? 'Leave added successfully' : 'Leave request submitted',
    data,
  });
});

const bulkApply = catchAsync(async (req, res) => {
  const data = await leaveService.bulkApplyLeave(req.body, req.user.id, req.companyId, req);
  sendCreated(res, {
    message: `Bulk leave add completed (${data.success} success, ${data.failed} failed)`,
    data,
  });
});

const creditBalance = catchAsync(async (req, res) => {
  const data = await leaveService.creditLeaveBalance(req.body, req.user.id, req.companyId, req);
  sendCreated(res, {
    message: `Leave balance credited successfully (${data.previousBalance} → ${data.balance})`,
    data,
  });
});

const bulkCreditBalance = catchAsync(async (req, res) => {
  const data = await leaveService.bulkCreditLeaveBalance(req.body, req.user.id, req.companyId, req);
  sendCreated(res, {
    message: `Bulk leave balance credit completed (${data.success} success, ${data.failed} failed)`,
    data,
  });
});

const cancel = catchAsync(async (req, res) => {
  const data = await leaveService.cancelLeave(req.params.id, req.body.reason, req.user.id, req.companyId, req);
  sendSuccess(res, { message: 'Leave request cancelled', data });
});

const approve = catchAsync(async (req, res) => {
  const data = await leaveService.approveLeave(
    req.params.id,
    req.body.comment,
    req.user.id,
    req.companyId,
    req
  );
  sendSuccess(res, { message: 'Leave request approved', data });
});

const reject = catchAsync(async (req, res) => {
  const data = await leaveService.rejectLeave(
    req.params.id,
    req.body.comment,
    req.user.id,
    req.companyId,
    req
  );
  sendSuccess(res, { message: 'Leave request rejected', data });
});

const getById = catchAsync(async (req, res) => {
  const data = await leaveService.getLeave(req.params.id, req.companyId, req.user);
  sendSuccess(res, { message: 'Leave request retrieved', data });
});

const list = catchAsync(async (req, res) => {
  const result = await leaveService.listLeaves(req.companyId, req.query, req.user);
  sendSuccess(res, { message: 'Leave requests retrieved', data: result.data, meta: result.meta });
});

const getBalances = catchAsync(async (req, res) => {
  const userId = req.query.userId || req.user.id;
  const data = await leaveService.getBalances(userId, req.companyId, req.user);
  sendSuccess(res, { message: 'Leave balances retrieved', data });
});

const getLedger = catchAsync(async (req, res) => {
  const data = await leaveService.getLedger(req.user.id, req.companyId, req.query);
  sendSuccess(res, { message: 'Leave ledger retrieved', data: data.data, meta: data.meta });
});

const report = catchAsync(async (req, res) => {
  const type = req.params.type || 'summary';
  const data = await reportService.generateReport(type, req.companyId, req.query);
  sendSuccess(res, { message: `${type} leave report`, data });
});

const monthlySummary = catchAsync(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
  const data = await reportService.getMonthlySummary(req.companyId, year, month);
  sendSuccess(res, { message: 'Monthly leave summary', data });
});

const calendar = catchAsync(async (req, res) => {
  const { isManagerRole, getTeamUserIds } = require('../managers/team.helper');
  const { SYSTEM_ROLES } = require('../../constants');
  const options = {};
  const scope = req.query.scope;
  const roleSlug = req.user?.roleSlug;

  if (scope === 'team' && isManagerRole(req.user)) {
    options.teamUserIds = await getTeamUserIds(req.user.id, req.companyId);
  } else if (
    scope === 'self' ||
    roleSlug === SYSTEM_ROLES.EMPLOYEE ||
    (isManagerRole(req.user) && scope !== 'team')
  ) {
    options.userIds = [req.user.id];
  }

  const data = await calendarService.getCalendar(
    req.companyId,
    parseInt(req.query.year, 10),
    parseInt(req.query.month, 10),
    options
  );
  sendSuccess(res, { message: 'Leave calendar', data });
});

const exportReport = catchAsync(async (req, res) => {
  const type = req.params.type || 'summary';
  const format = req.query.format || 'xlsx';
  const { filepath, filename } = await exportService.exportReport(
    type,
    req.companyId,
    req.query,
    req.user.id,
    req,
    format
  );
  res.download(filepath, filename);
});

module.exports = {
  apply,
  bulkApply,
  creditBalance,
  bulkCreditBalance,
  cancel,
  approve,
  reject,
  getById,
  list,
  getBalances,
  getLedger,
  report,
  monthlySummary,
  calendar,
  exportReport,
};
