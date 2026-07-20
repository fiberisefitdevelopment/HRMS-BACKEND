const { Router } = require('express');
const compOffController = require('./compOff.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const {
  raiseCompOffSchema,
  cancelCompOffSchema,
  approveRejectSchema,
  compOffIdParamSchema,
  eligibilityQuerySchema,
  listQuerySchema,
} = require('./compOff.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get(
  '/eligibility',
  requirePermission('comp_off.create'),
  validate(eligibilityQuerySchema, 'query'),
  compOffController.eligibility
);

router.post('/', requirePermission('comp_off.create'), validate(raiseCompOffSchema), compOffController.raise);

router.get('/', requirePermission('comp_off.read'), validate(listQuerySchema, 'query'), compOffController.list);

router.get(
  '/:id',
  requirePermission('comp_off.read'),
  validate(compOffIdParamSchema, 'params'),
  compOffController.getById
);

router.put(
  '/:id/approve',
  requirePermission('comp_off.approve'),
  validate(compOffIdParamSchema, 'params'),
  validate(approveRejectSchema),
  compOffController.approve
);

router.put(
  '/:id/reject',
  requirePermission('comp_off.approve'),
  validate(compOffIdParamSchema, 'params'),
  validate(approveRejectSchema),
  compOffController.reject
);

router.put(
  '/:id/cancel',
  requirePermission('comp_off.cancel'),
  validate(compOffIdParamSchema, 'params'),
  validate(cancelCompOffSchema),
  compOffController.cancel
);

module.exports = router;
