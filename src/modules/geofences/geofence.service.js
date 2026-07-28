const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const geofenceRepository = require('./geofence.repository');
const geofenceEngine = require('../attendance/engines/geofence.engine');

const formatGeofence = (g) => ({
  id: g._id,
  companyId: g.companyId,
  name: g.name,
  latitude: g.latitude,
  longitude: g.longitude,
  radiusMeters: g.radiusMeters,
  radius: g.radiusMeters,
  address: g.address || null,
  isActive: g.isActive,
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
});

const listGeofences = async (companyId, query = {}) => {
  const filter = { companyId };
  if (query.isActive === 'true') filter.isActive = true;
  if (query.isActive === 'false') filter.isActive = false;

  const result = await geofenceRepository.findMany(filter, query, { companyId });
  return { data: result.data.map(formatGeofence), meta: result.meta };
};

const getGeofence = async (id, companyId) => {
  const geofence = await geofenceRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!geofence) throw ApiError.notFound('Geofence not found');
  return formatGeofence(geofence);
};

const createGeofence = async (data, companyId, actorId, req) => {
  const geofence = await geofenceRepository.create({
    ...data,
    companyId,
    createdBy: actorId,
    updatedBy: actorId,
  });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'create',
    entityType: 'office_geofence',
    entityId: geofence._id,
    req,
  });

  return formatGeofence(geofence);
};

const updateGeofence = async (id, data, companyId, actorId, req) => {
  const existing = await geofenceRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!existing) throw ApiError.notFound('Geofence not found');

  const updated = await geofenceRepository.updateById(
    id,
    { ...data, updatedBy: actorId },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'update',
    entityType: 'office_geofence',
    entityId: id,
    req,
  });

  return formatGeofence(updated);
};

const deleteGeofence = async (id, companyId, actorId, req) => {
  const existing = await geofenceRepository.findOne({ _id: id, companyId }, null, { companyId });
  if (!existing) throw ApiError.notFound('Geofence not found');

  await geofenceRepository.updateById(id, { isActive: false, updatedBy: actorId }, { companyId });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'delete',
    entityType: 'office_geofence',
    entityId: id,
    req,
  });
};

const validateLocation = async (companyId, latitude, longitude) => {
  const result = await geofenceEngine.evaluateLocation(companyId, latitude, longitude);
  return {
    allowed: result.allowed,
    distanceMeters: result.distanceMeters,
    matchedOffice: result.matchedOffice,
    nearestOffice: result.nearestOffice,
  };
};

module.exports = {
  listGeofences,
  getGeofence,
  createGeofence,
  updateGeofence,
  deleteGeofence,
  validateLocation,
  formatGeofence,
};
