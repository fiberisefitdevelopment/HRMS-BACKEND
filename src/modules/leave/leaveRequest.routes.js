const { Router } = require('express');
const leaveController = require('./leaveRequest.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { uploadLeaveAttachment } = require('../../config/upload');
const { parseLeaveApplyUpload } = require('./leaveUpload.middleware');
const {
  applyLeaveSchema,
  bulkLeaveSchema,
  creditBalanceSchema,
  bulkCreditBalanceSchema,
  approveRejectSchema,
  cancelLeaveSchema,
  leaveIdParamSchema,
  listQuerySchema,
  calendarQuerySchema,
  reportQuerySchema,
} = require('./leaveRequest.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.post(
  '/',
  requirePermission('leave.create'),
  uploadLeaveAttachment.single('prescription'),
  parseLeaveApplyUpload,
  validate(applyLeaveSchema),
  leaveController.apply
);
router.post(
  '/bulk',
  requirePermission('leave.create'),
  validate(bulkLeaveSchema),
  leaveController.bulkApply
);
router.post(
  '/balances/credit',
  requirePermission('leave.policy.manage'),
  validate(creditBalanceSchema),
  leaveController.creditBalance
);
router.post(
  '/balances/credit/bulk',
  requirePermission('leave.policy.manage'),
  validate(bulkCreditBalanceSchema),
  leaveController.bulkCreditBalance
);
router.get('/', requirePermission('leave.read'), validate(listQuerySchema, 'query'), leaveController.list);
router.get('/balances', requirePermission('leave.balance.read'), leaveController.getBalances);
router.get('/ledger', requirePermission('leave.balance.read'), leaveController.getLedger);
router.get('/calendar', requirePermission('leave.calendar.read'), validate(calendarQuerySchema, 'query'), leaveController.calendar);
router.get('/monthly-summary', requirePermission('leave.read'), leaveController.monthlySummary);
router.get('/reports/:type', requirePermission('leave.report'), validate(reportQuerySchema, 'query'), leaveController.report);
router.get('/reports', requirePermission('leave.report'), validate(reportQuerySchema, 'query'), leaveController.report);
router.get('/export/:type', requirePermission('leave.export'), validate(reportQuerySchema, 'query'), leaveController.exportReport);

router.get('/:id', requirePermission('leave.read'), validate(leaveIdParamSchema, 'params'), leaveController.getById);
router.put(
  '/:id/approve',
  requirePermission('leave.approve'),
  validate(leaveIdParamSchema, 'params'),
  validate(approveRejectSchema),
  leaveController.approve
);
router.put(
  '/:id/reject',
  requirePermission('leave.approve'),
  validate(leaveIdParamSchema, 'params'),
  validate(approveRejectSchema),
  leaveController.reject
);
router.put(
  '/:id/cancel',
  requirePermission('leave.cancel'),
  validate(leaveIdParamSchema, 'params'),
  validate(cancelLeaveSchema),
  leaveController.cancel
);

module.exports = router;
