const { Router } = require('express');
const designationController = require('./designation.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const {
  createDesignationSchema,
  updateDesignationSchema,
  designationIdParamSchema,
} = require('./designation.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/', requirePermission('designation.read'), designationController.list);
router.post(
  '/',
  requirePermission('designation.create'),
  validate(createDesignationSchema),
  designationController.create
);
router.get(
  '/:id',
  requirePermission('designation.read'),
  validate(designationIdParamSchema, 'params'),
  designationController.getById
);
router.put(
  '/:id',
  requirePermission('designation.update'),
  validate(designationIdParamSchema, 'params'),
  validate(updateDesignationSchema),
  designationController.update
);
router.delete(
  '/:id',
  requirePermission('designation.delete'),
  validate(designationIdParamSchema, 'params'),
  designationController.remove
);

module.exports = router;
