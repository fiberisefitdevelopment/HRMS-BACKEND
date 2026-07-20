const ApiError = require('../../../utils/ApiError');
const OfficeGeofence = require('../../geofences/officeGeofence.model');
const policyEngine = require('./policy.engine');

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatOfficeSummary = (office, distanceMeters) => {
  if (!office) return null;
  return {
    id: office._id,
    name: office.name,
    latitude: office.latitude,
    longitude: office.longitude,
    radiusMeters: office.radiusMeters,
    distanceMeters: distanceMeters != null ? Math.round(distanceMeters) : null,
  };
};

const evaluateLocation = async (companyId, latitude, longitude) => {
  const offices = await OfficeGeofence.find({ companyId, isActive: true }, null, { companyId });

  if (!offices.length) {
    return {
      allowed: false,
      distanceMeters: null,
      matchedOffice: null,
      nearestOffice: null,
      reason: 'no_active_geofences',
    };
  }

  let nearest = null;
  let matched = null;

  for (const office of offices) {
    const distance = haversineDistanceMeters(
      latitude,
      longitude,
      office.latitude,
      office.longitude
    );

    if (!nearest || distance < nearest.distance) {
      nearest = { office, distance };
    }

    if (distance <= office.radiusMeters && (!matched || distance < matched.distance)) {
      matched = { office, distance };
    }
  }

  return {
    allowed: Boolean(matched),
    distanceMeters: matched
      ? Math.round(matched.distance)
      : nearest
        ? Math.round(nearest.distance)
        : null,
    matchedOffice: matched ? formatOfficeSummary(matched.office, matched.distance) : null,
    nearestOffice: nearest ? formatOfficeSummary(nearest.office, nearest.distance) : null,
    reason: matched ? 'inside' : 'outside',
  };
};

const GEOFENCE_BYPASS_SOURCES = new Set(['manual']);

const assertPunchAllowed = async (
  companyId,
  coords,
  action,
  source = 'web',
  employeeProfileId = null
) => {
  if (GEOFENCE_BYPASS_SOURCES.has(source)) {
    return { skipped: true, reason: 'bypass_source' };
  }

  const policy = await policyEngine.getPolicyForCompany(companyId);
  const geofencing = policy.geofencing || {};

  if (!geofencing.enabled) {
    return { skipped: true, reason: 'geofencing_disabled' };
  }

  const applyToAll = geofencing.applyToAllEmployees !== false;
  if (!applyToAll) {
    const allowedIds = (geofencing.employeeProfileIds || []).map((id) => String(id));
    if (!employeeProfileId || !allowedIds.includes(String(employeeProfileId))) {
      return { skipped: true, reason: 'employee_not_in_scope' };
    }
  }

  const enforce =
    action === 'punch_out'
      ? geofencing.enforceOnPunchOut !== false
      : geofencing.enforceOnPunchIn !== false;

  if (!enforce) {
    return { skipped: true, reason: 'enforce_disabled_for_action' };
  }

  if (coords?.latitude == null || coords?.longitude == null) {
    throw ApiError.badRequest('Latitude and longitude are required when geofencing is enabled');
  }

  const result = await evaluateLocation(companyId, coords.latitude, coords.longitude);

  if (result.reason === 'no_active_geofences') {
    throw ApiError.badRequest(
      'Geofencing is enabled but no active office geofences are configured. Contact HR.'
    );
  }

  if (!result.allowed) {
    const nearest = result.nearestOffice;
    const detail = nearest
      ? ` Nearest office "${nearest.name}" is ${nearest.distanceMeters}m away (allowed ${nearest.radiusMeters}m).`
      : '';
    throw new ApiError(403, `Punch not allowed outside the office geofence.${detail}`, 'FORBIDDEN', {
      geofence: result,
    });
  }

  return { skipped: false, ...result };
};

module.exports = {
  haversineDistanceMeters,
  evaluateLocation,
  assertPunchAllowed,
  formatOfficeSummary,
};
