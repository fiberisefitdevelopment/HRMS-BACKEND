const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const geofenceRepository = require('./geofence.repository');
const geofenceEngine = require('../attendance/engines/geofence.engine');
const policyEngine = require('../attendance/engines/policy.engine');

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

const getGeofencingEnabled = async (companyId) => {
  try {
    const policy = await policyEngine.getPolicyForCompany(companyId);
    return policy.geofencing?.enabled === true;
  } catch {
    return false;
  }
};

const listGeofences = async (companyId, query = {}, options = {}) => {
  const geofencingEnabled = await getGeofencingEnabled(companyId);

  // When policy is off, employees/mobile must not receive office zones (no radius on map).
  // HR with geofence.manage can still list them for configuration.
  if (!geofencingEnabled && !options.includeWhenDisabled) {
    return {
      data: [],
      meta: {
        page: 1,
        limit: 0,
        total: 0,
        totalPages: 0,
        geofencingEnabled: false,
      },
    };
  }

  const filter = { companyId };
  if (query.isActive === 'true') filter.isActive = true;
  if (query.isActive === 'false') filter.isActive = false;

  const result = await geofenceRepository.findMany(filter, query, { companyId });
  return {
    data: result.data.map(formatGeofence),
    meta: { ...result.meta, geofencingEnabled },
  };
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
  const geofencingEnabled = await getGeofencingEnabled(companyId);

  // Policy off: mobile/web must treat location as allowed (no office zone required).
  if (!geofencingEnabled) {
    return {
      allowed: true,
      skipped: true,
      reason: 'geofencing_disabled',
      geofencingEnabled: false,
      distanceMeters: null,
      matchedOffice: null,
      nearestOffice: null,
    };
  }

  const result = await geofenceEngine.evaluateLocation(companyId, latitude, longitude);
  return {
    allowed: result.allowed,
    skipped: false,
    reason: result.reason,
    geofencingEnabled: true,
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
