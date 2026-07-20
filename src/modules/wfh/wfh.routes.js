const { Router } = require('express');
const wfhController = require('./wfh.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const {
  applyWfhSchema,
  approveRejectSchema,
  wfhIdParamSchema,
  listQuerySchema,
} = require('./wfh.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.post('/', requirePermission('wfh.create'), validate(applyWfhSchema), wfhController.apply);

router.get('/', requirePermission('wfh.read'), validate(listQuerySchema, 'query'), wfhController.list);

router.get(
  '/:id',
  requirePermission('wfh.read'),
  validate(wfhIdParamSchema, 'params'),
  wfhController.getById
);

router.put(
  '/:id/approve',
  requirePermission('wfh.approve'),
  validate(wfhIdParamSchema, 'params'),
  validate(approveRejectSchema),
  wfhController.approve
);

router.put(
  '/:id/reject',
  requirePermission('wfh.approve'),
  validate(wfhIdParamSchema, 'params'),
  validate(approveRejectSchema),
  wfhController.reject
);

module.exports = router;
