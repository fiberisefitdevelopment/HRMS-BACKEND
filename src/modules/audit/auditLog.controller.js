const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../helpers/response');
const auditLogService = require('./auditLog.service');

const list = catchAsync(async (req, res) => {
  const result = await auditLogService.listAuditLogs(req.companyId, req.query, req.user);
  sendSuccess(res, {
    message: 'Audit logs retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

module.exports = { list };
