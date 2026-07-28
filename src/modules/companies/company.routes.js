const { Router } = require('express');
const companyController = require('./company.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const {
  createCompanySchema,
  updateCompanySchema,
  companyIdParamSchema,
} = require('./company.validation');

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('company.read'), companyController.list);
router.post('/', requirePermission('company.create'), validate(createCompanySchema), companyController.create);
router.get('/:id', requirePermission('company.read'), validate(companyIdParamSchema, 'params'), companyController.getById);
router.put(
  '/:id',
  requirePermission('company.update'),
  validate(companyIdParamSchema, 'params'),
  validate(updateCompanySchema),
  companyController.update
);
router.delete(
  '/:id',
  requirePermission('company.delete'),
  validate(companyIdParamSchema, 'params'),
  companyController.remove
);
router.post(
  '/:id/activate',
  requirePermission('company.activate'),
  validate(companyIdParamSchema, 'params'),
  companyController.activate
);
router.post(
  '/:id/deactivate',
  requirePermission('company.deactivate'),
  validate(companyIdParamSchema, 'params'),
  companyController.deactivate
);

module.exports = router;
