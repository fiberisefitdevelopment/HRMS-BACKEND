const { Router } = require('express');
const employeeController = require('./employee.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { uploadPhoto, uploadSpreadsheet } = require('../../config/upload');
const {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdParamSchema,
  bulkIdsSchema,
  bulkDepartmentSchema,
  bulkDesignationSchema,
  bulkManagerSchema,
} = require('./employee.validation');

const runUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (err) return next(err);
    next();
  });
};

const router = Router();

router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.get('/me', employeeController.getMe);
router.get('/me/photo', employeeController.getMyPhoto);
router.post(
  '/me/photo',
  requirePermission('profile.upload'),
  runUpload(uploadPhoto.single('photo')),
  employeeController.uploadMyPhoto
);
router.delete(
  '/me/photo',
  requirePermission('profile.upload'),
  employeeController.deleteMyPhoto
);

router.get('/', requirePermission('employee.read'), employeeController.list);
router.post(
  '/',
  requirePermission('employee.create'),
  validate(createEmployeeSchema),
  employeeController.create
);

router.post('/import/preview', requirePermission('employee.import'), uploadSpreadsheet.single('file'), employeeController.importPreview);
router.post('/import', requirePermission('employee.import'), uploadSpreadsheet.single('file'), employeeController.importExecute);

router.get('/export/:type', requirePermission('employee.export'), employeeController.exportData);
router.get('/export', requirePermission('employee.export'), employeeController.exportData);

router.post('/bulk/activate', requirePermission('employee.bulk'), validate(bulkIdsSchema), employeeController.bulkActivate);
router.post('/bulk/deactivate', requirePermission('employee.bulk'), validate(bulkIdsSchema), employeeController.bulkDeactivate);
router.post('/bulk/delete', requirePermission('employee.bulk'), validate(bulkIdsSchema), employeeController.bulkDelete);
router.post('/bulk/department', requirePermission('employee.bulk'), validate(bulkDepartmentSchema), employeeController.bulkDepartment);
router.post('/bulk/designation', requirePermission('employee.bulk'), validate(bulkDesignationSchema), employeeController.bulkDesignation);
router.post('/bulk/manager', requirePermission('employee.bulk'), validate(bulkManagerSchema), employeeController.bulkManager);

router.get(
  '/:id',
  requirePermission('employee.read'),
  validate(employeeIdParamSchema, 'params'),
  employeeController.getById
);
router.put(
  '/:id',
  requirePermission('employee.update'),
  validate(employeeIdParamSchema, 'params'),
  validate(updateEmployeeSchema),
  employeeController.update
);
router.delete(
  '/:id',
  requirePermission('employee.delete'),
  validate(employeeIdParamSchema, 'params'),
  employeeController.remove
);
router.post(
  '/:id/activate',
  requirePermission('employee.update'),
  validate(employeeIdParamSchema, 'params'),
  employeeController.activate
);
router.post(
  '/:id/deactivate',
  requirePermission('employee.update'),
  validate(employeeIdParamSchema, 'params'),
  employeeController.deactivate
);
router.get(
  '/:id/photo',
  requirePermission('employee.read'),
  validate(employeeIdParamSchema, 'params'),
  employeeController.getPhoto
);
router.post(
  '/:id/photo',
  requirePermission('profile.upload'),
  validate(employeeIdParamSchema, 'params'),
  runUpload(uploadPhoto.single('photo')),
  employeeController.uploadPhoto
);
router.delete(
  '/:id/photo',
  requirePermission('profile.upload'),
  validate(employeeIdParamSchema, 'params'),
  employeeController.deletePhoto
);

module.exports = router;
