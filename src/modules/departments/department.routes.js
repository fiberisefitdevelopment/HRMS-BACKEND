const { Router } = require('express');
const departmentController = require('./department.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentIdParamSchema,
} = require('./department.validation');

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/', requirePermission('department.read'), departmentController.list);
router.post(
  '/',
  requirePermission('department.create'),
  validate(createDepartmentSchema),
  departmentController.create
);
router.get(
  '/:id',
  requirePermission('department.read'),
  validate(departmentIdParamSchema, 'params'),
  departmentController.getById
);
router.put(
  '/:id',
  requirePermission('department.update'),
  validate(departmentIdParamSchema, 'params'),
  validate(updateDepartmentSchema),
  departmentController.update
);
router.delete(
  '/:id',
  requirePermission('department.delete'),
  validate(departmentIdParamSchema, 'params'),
  departmentController.remove
);

module.exports = router;
