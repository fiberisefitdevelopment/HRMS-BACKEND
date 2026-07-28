const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendCreated } = require('../../helpers/response');
const geofenceService = require('./geofence.service');

const list = catchAsync(async (req, res) => {
  const { data, meta } = await geofenceService.listGeofences(req.companyId, req.query);
  sendSuccess(res, { message: 'Geofences retrieved', data, meta });
});

const getById = catchAsync(async (req, res) => {
  // Public access may omit company filter when only :id is known —
  // still scoped: geofence must belong to resolved company when company query is present.
  const data = await geofenceService.getGeofence(req.params.id, req.companyId);
  sendSuccess(res, { message: 'Geofence retrieved', data });
});

const create = catchAsync(async (req, res) => {
  const data = await geofenceService.createGeofence(req.body, req.companyId, req.user.id, req);
  sendCreated(res, { message: 'Geofence created', data });
});

const update = catchAsync(async (req, res) => {
  const data = await geofenceService.updateGeofence(
    req.params.id,
    req.body,
    req.companyId,
    req.user.id,
    req
  );
  sendSuccess(res, { message: 'Geofence updated', data });
});

const remove = catchAsync(async (req, res) => {
  await geofenceService.deleteGeofence(req.params.id, req.companyId, req.user.id, req);
  sendSuccess(res, { message: 'Geofence deactivated' });
});

const validateLocation = catchAsync(async (req, res) => {
  const data = await geofenceService.validateLocation(
    req.companyId,
    req.body.latitude,
    req.body.longitude
  );
  sendSuccess(res, { message: 'Location validated', data });
});

module.exports = { list, getById, create, update, remove, validateLocation };
