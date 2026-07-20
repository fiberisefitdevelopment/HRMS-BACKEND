const { Router } = require('express');
const geofenceController = require('./geofence.controller');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/permission.middleware');
const { requireCompanyContext, attachCompanyScope } = require('../../middlewares/companyContext.middleware');
const { optionalAuthOrPublicCompany } = require('../../middlewares/resolvePublicCompany.middleware');
const {
  createGeofenceSchema,
  updateGeofenceSchema,
  geofenceIdParamSchema,
  validateLocationSchema,
} = require('./geofence.validation');

const router = Router();

// Public GETs (no token) OR authenticated — no permission required on read
// Without token: pass ?companyId= or ?companyCode=
router.get('/', optionalAuthOrPublicCompany, geofenceController.list);
router.get(
  '/:id',
  validate(geofenceIdParamSchema, 'params'),
  optionalAuthOrPublicCompany,
  geofenceController.getById
);

// Authenticated mutations + validate
router.use(authenticate, requireCompanyContext, attachCompanyScope);

router.post(
  '/',
  requirePermission('geofence.manage'),
  validate(createGeofenceSchema),
  geofenceController.create
);
router.post(
  '/validate',
  requirePermission('attendance.punch'),
  validate(validateLocationSchema),
  geofenceController.validateLocation
);
router.put(
  '/:id',
  requirePermission('geofence.manage'),
  validate(geofenceIdParamSchema, 'params'),
  validate(updateGeofenceSchema),
  geofenceController.update
);
router.delete(
  '/:id',
  requirePermission('geofence.manage'),
  validate(geofenceIdParamSchema, 'params'),
  geofenceController.remove
);

module.exports = router;
