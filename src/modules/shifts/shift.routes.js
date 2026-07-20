const { Router } = require('express');
const shiftController = require('./shift.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const {
  createShiftSchema,
  updateShiftSchema,
  assignShiftSchema,
  shiftIdParamSchema,
} = require('./shift.validation');
const { z } = require('zod');

const unassignSchema = z.object({
  employeeProfileId: z.string().regex(/^[a-fA-F0-9]{24}$/),
});

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/', requirePermission('attendance.shift.manage'), shiftController.list);
router.post(
  '/',
  requirePermission('attendance.shift.manage'),
  validate(createShiftSchema),
  shiftController.create
);
router.get(
  '/:id',
  requirePermission('attendance.shift.manage'),
  validate(shiftIdParamSchema, 'params'),
  shiftController.getById
);
router.put(
  '/:id',
  requirePermission('attendance.shift.manage'),
  validate(shiftIdParamSchema, 'params'),
  validate(updateShiftSchema),
  shiftController.update
);
router.delete(
  '/:id',
  requirePermission('attendance.shift.manage'),
  validate(shiftIdParamSchema, 'params'),
  shiftController.remove
);
router.post('/assign', requirePermission('attendance.shift.manage'), validate(assignShiftSchema), shiftController.assign);
router.post('/unassign', requirePermission('attendance.shift.manage'), validate(unassignSchema), shiftController.unassign);

module.exports = router;
