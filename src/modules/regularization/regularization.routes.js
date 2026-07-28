const { Router } = require('express');
const regularizationController = require('./regularization.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const {
  raiseRegularizationSchema,
  regularizationIdParamSchema,
  eligibilityQuerySchema,
  listQuerySchema,
} = require('./regularization.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get(
  '/eligibility',
  requirePermission('regularization.create'),
  validate(eligibilityQuerySchema, 'query'),
  regularizationController.eligibility
);

router.post(
  '/',
  requirePermission('regularization.create'),
  validate(raiseRegularizationSchema),
  regularizationController.raise
);

router.get(
  '/',
  requirePermission('regularization.read'),
  validate(listQuerySchema, 'query'),
  regularizationController.list
);

router.get(
  '/:id',
  requirePermission('regularization.read'),
  validate(regularizationIdParamSchema, 'params'),
  regularizationController.getById
);

module.exports = router;
