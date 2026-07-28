const geofenceEngine = require('./geofence.engine');
const workingHoursEngine = require('./workingHours.engine');

/** Heartbeats worse than this are ignored when a punch location exists. */
const POOR_ACCURACY_METERS = 150;
/** Reject heartbeat updates this far from the punch-in point. */
const MAX_JUMP_FROM_PUNCH_METERS = 2000;

const coordsFromPunchMeta = (meta) => {
  if (!meta || meta.latitude == null || meta.longitude == null) return null;
  return {
    latitude: meta.latitude,
    longitude: meta.longitude,
    accuracyMeters: meta.accuracyMeters,
  };
};

const getPunchCoords = (record) => {
  if (!record) return null;
  const firstPunch = workingHoursEngine.getFirstPunchIn(record);
  return coordsFromPunchMeta(firstPunch) || coordsFromPunchMeta(record.punchIn);
};

const toLastKnownShape = (coords, source = 'punch', recordedAt = new Date()) => {
  if (!coords) return null;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    ...(coords.accuracyMeters != null ? { accuracyMeters: coords.accuracyMeters } : {}),
    recordedAt,
    source,
  };
};

const distanceBetween = (a, b) => {
  if (!a || !b) return null;
  return geofenceEngine.haversineDistanceMeters(a.latitude, a.longitude, b.latitude, b.longitude);
};

/**
 * Prefer punch-in coordinates when heartbeat GPS is coarse or implausibly far away.
 */
const resolveDisplayLocation = (record) => {
  if (!record) return null;

  const punchCoords = getPunchCoords(record);
  const lastKnown = record.lastKnownLocation || null;

  if (!lastKnown) {
    return punchCoords ? toLastKnownShape(punchCoords, 'punch', record.punchIn?.timestamp || new Date()) : null;
  }

  if (lastKnown.source !== 'heartbeat' || !punchCoords) {
    return lastKnown;
  }

  const jumpMeters = distanceBetween(punchCoords, lastKnown);
  const heartbeatPoor =
    lastKnown.accuracyMeters == null || lastKnown.accuracyMeters > POOR_ACCURACY_METERS;

  if (heartbeatPoor || (jumpMeters != null && jumpMeters > MAX_JUMP_FROM_PUNCH_METERS)) {
    return toLastKnownShape(punchCoords, 'punch', record.punchIn?.timestamp || lastKnown.recordedAt);
  }

  return lastKnown;
};

const shouldAcceptHeartbeatUpdate = (existing, incomingCoords, record = null) => {
  if (!incomingCoords) return false;
  if (!existing) return true;

  const punchCoords = record ? getPunchCoords(record) : null;
  const punchRef = punchCoords || (existing.source === 'punch' ? existing : null);

  if (!punchRef) return true;

  const jumpMeters = distanceBetween(punchRef, incomingCoords);
  const incomingPoor =
    incomingCoords.accuracyMeters == null || incomingCoords.accuracyMeters > POOR_ACCURACY_METERS;

  if (incomingPoor) return false;
  if (jumpMeters != null && jumpMeters > MAX_JUMP_FROM_PUNCH_METERS) return false;

  if (
    existing.source === 'heartbeat' &&
    existing.accuracyMeters != null &&
    incomingCoords.accuracyMeters != null &&
    incomingCoords.accuracyMeters >= existing.accuracyMeters
  ) {
    return false;
  }

  return true;
};

module.exports = {
  POOR_ACCURACY_METERS,
  MAX_JUMP_FROM_PUNCH_METERS,
  getPunchCoords,
  resolveDisplayLocation,
  shouldAcceptHeartbeatUpdate,
  toLastKnownShape,
};
