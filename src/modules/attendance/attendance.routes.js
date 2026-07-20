const { Router } = require('express');
const attendanceController = require('./attendance.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { optionalAuthOrPublicCompany } = require('../../middlewares/resolvePublicCompany.middleware');
const {
  punchSchema,
  locationHeartbeatSchema,
  breakSchema,
  correctAttendanceSchema,
  attendanceIdParamSchema,
  monthlySummarySchema,
  musterRollQuerySchema,
} = require('./attendance.validation');

const router = Router();

// Public (no token) OR authenticated — live employee locations
// Without token: pass ?companyId= or ?companyCode=
// Optional: ?managerUserId= to filter one manager's team
router.get(
  '/dashboard/manager/live',
  optionalAuthOrPublicCompany,
  attendanceController.managerLiveDashboard
);

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.post('/punch-in', requirePermission('attendance.punch'), validate(punchSchema), attendanceController.punchIn);
router.post('/punch-out', requirePermission('attendance.punch'), validate(punchSchema), attendanceController.punchOut);
router.post(
  '/location',
  requirePermission('attendance.punch'),
  validate(locationHeartbeatSchema),
  attendanceController.updateLocation
);
router.post('/break/start', requirePermission('attendance.punch'), validate(breakSchema), attendanceController.startBreak);
router.post('/break/end', requirePermission('attendance.punch'), validate(breakSchema), attendanceController.endBreak);

router.get('/today', attendanceController.getToday);
router.get('/dashboard/employee', requirePermission('attendance.dashboard'), attendanceController.employeeDashboard);
router.get('/dashboard/manager', requirePermission('attendance.dashboard'), attendanceController.managerDashboard);
router.get('/dashboard/hr', requirePermission('attendance.dashboard'), attendanceController.hrDashboard);

router.get('/monthly-summary', validate(monthlySummarySchema, 'query'), attendanceController.monthlySummary);
router.get(
  '/muster-roll',
  requirePermission('attendance.report'),
  validate(musterRollQuerySchema, 'query'),
  attendanceController.musterRoll
);
router.get('/reports/:type', requirePermission('attendance.report'), attendanceController.report);
router.get('/reports', requirePermission('attendance.report'), attendanceController.report);
router.get('/export/:type', requirePermission('attendance.export'), attendanceController.exportReport);

router.get('/', requirePermission('attendance.view'), attendanceController.list);
router.put(
  '/:id/correct',
  requirePermission('attendance.update'),
  validate(attendanceIdParamSchema, 'params'),
  validate(correctAttendanceSchema),
  attendanceController.correct
);

module.exports = router;
