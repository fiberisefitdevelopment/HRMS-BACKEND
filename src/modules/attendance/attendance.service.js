const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { getDateOnly } = require('../../utils/time');
const attendanceRepository = require('./attendance.repository');
const shiftEngine = require('./engines/shift.engine');
const breakEngine = require('./engines/break.engine');
const workingHoursEngine = require('./engines/workingHours.engine');
const regularizationEngine = require('./engines/regularization.engine');
const geofenceEngine = require('./engines/geofence.engine');
const { getEmployeeProfileByUser } = require('./attendance.helper');
const EmployeeShiftAssignment = require('../shifts/employeeShiftAssignment.model');

const extractCoords = (body = {}) => {
  if (body.latitude == null || body.longitude == null) return null;
  return {
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
    accuracyMeters: body.accuracyMeters != null ? Number(body.accuracyMeters) : undefined,
  };
};

const buildPunchMeta = (req, source = 'web') => {
  const coords = extractCoords(req.body || {});
  return {
    timestamp: new Date(),
    source,
    device: req.get('user-agent')?.includes('Mobile') ? 'mobile' : 'desktop',
    browser: req.get('user-agent'),
    ip: req.ip,
    ...(coords
      ? {
          latitude: coords.latitude,
          longitude: coords.longitude,
          ...(coords.accuracyMeters != null ? { accuracyMeters: coords.accuracyMeters } : {}),
        }
      : {}),
  };
};

const buildLastKnownLocation = (coords, source = 'punch') => {
  if (!coords) return null;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    ...(coords.accuracyMeters != null ? { accuracyMeters: coords.accuracyMeters } : {}),
    recordedAt: new Date(),
    source,
  };
};

const resolveShiftFromRecord = (shiftId, shiftFallback = null) => {
  if (shiftId && typeof shiftId === 'object' && (shiftId._id || shiftId.id)) {
    return {
      id: shiftId._id || shiftId.id,
      name: shiftId.name,
      code: shiftId.code,
      startTime: shiftId.startTime,
      endTime: shiftId.endTime,
    };
  }
  return shiftFallback;
};

const formatRecord = (r, shiftFallback = null) => {
  const shift = resolveShiftFromRecord(r.shiftId, shiftFallback);
  const shiftIdValue =
    shift?.id ||
    (r.shiftId && typeof r.shiftId === 'object' ? r.shiftId._id : r.shiftId) ||
    null;

  const computedHours = workingHoursEngine.calculateWorkingHours(r, null);
  const netWorkingMinutes = computedHours.netWorkingMinutes || r.netWorkingMinutes || 0;
  const grossWorkingMinutes = computedHours.grossWorkingMinutes || r.grossWorkingMinutes || 0;

  return {
    id: r._id,
    employeeProfileId: r.employeeProfileId,
    userId: r.userId,
    shiftId: shiftIdValue,
    shift,
    date: r.date,
    punchIn: r.punchIn || workingHoursEngine.getFirstPunchIn(r),
    punchOut: workingHoursEngine.hasOpenSession(r)
      ? null
      : r.punchOut || workingHoursEngine.getLastPunchOut(r),
    punchSessions: workingHoursEngine.getSessions(r).map((s) => ({
      punchIn: s.punchIn || null,
      punchOut: s.punchOut || null,
    })),
    lunchStart: r.lunchStart,
    lunchEnd: r.lunchEnd,
    teaBreak1Start: r.teaBreak1Start,
    teaBreak1End: r.teaBreak1End,
    teaBreak2Start: r.teaBreak2Start,
    teaBreak2End: r.teaBreak2End,
    grossWorkingMinutes,
    breakDurationMinutes: r.breakDurationMinutes || computedHours.breakDurationMinutes || 0,
    netWorkingMinutes,
    lateByMinutes: r.lateByMinutes,
    earlyExitMinutes: r.earlyExitMinutes ?? computedHours.earlyExitMinutes ?? 0,
    isRegularized: r.isRegularized,
    attendanceStatus: r.attendanceStatus,
    attendanceSource: r.attendanceSource,
    isAutoPunchOut: r.isAutoPunchOut,
    remarks: r.remarks,
    lastKnownLocation: r.lastKnownLocation || null,
    employee: r.employeeProfileId,
    user: r.userId,
  };
};

const getShiftFallbackForProfile = async (employeeProfileId, cache) => {
  const profileKey = String(employeeProfileId?._id || employeeProfileId);
  if (cache.has(profileKey)) return cache.get(profileKey);

  const assignment = await shiftEngine.getActiveShiftAssignment(profileKey, cache.companyId);
  const shift = shiftEngine.formatShiftRef(assignment?.shiftId);
  cache.set(profileKey, shift);
  return shift;
};

const getOrCreateTodayRecord = async (profile, companyId, shiftConfig) => {
  const today = getDateOnly();
  let record = await attendanceRepository.findTodayRecord(profile._id, companyId);

  if (!record) {
    const assignment = await EmployeeShiftAssignment.findOne(
      { employeeProfileId: profile._id, companyId, isActive: true },
      null,
      { companyId }
    );

    record = await attendanceRepository.create({
      companyId,
      employeeProfileId: profile._id,
      userId: profile.userId,
      shiftId: assignment?.shiftId,
      date: today,
      attendanceStatus: shiftEngine.isWorkingDay(shiftConfig, today) ? 'absent' : 'week_off',
    });
  }

  return record;
};

const punchIn = async (userId, companyId, req, source = 'web') => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const shiftConfig = await shiftEngine.getEmployeeShift(profile._id, companyId);

  // Weekly offs are allowed — employees can work Sat/Sun (or Sun on 6-day) and raise comp-off
  const coords = extractCoords(req.body || {});
  const geofenceResult = await geofenceEngine.assertPunchAllowed(
    companyId,
    coords,
    'punch_in',
    source,
    profile._id
  );

  const record = await getOrCreateTodayRecord(profile, companyId, shiftConfig);

  if (workingHoursEngine.hasOpenSession(record)) {
    throw ApiError.conflict('Already punched in. Punch out before punching in again');
  }

  const punchMeta = buildPunchMeta(req, source);
  const sessions = workingHoursEngine.getSessions(record);
  const isFirstPunchOfDay = sessions.length === 0;

  let attendanceStatus = record.attendanceStatus || 'present';
  let lateByMinutes = record.lateByMinutes || 0;
  let isRegularized = record.isRegularized || false;
  let regularizationMonthCount = record.regularizationMonthCount;
  let lateResult = { isLate: false, lateByMinutes: 0 };

  if (isFirstPunchOfDay) {
    const isWeeklyOff = !shiftEngine.isWorkingDay(shiftConfig, record.date || punchMeta.timestamp);

    if (isWeeklyOff) {
      // Weekly off (5-day: Sat/Sun, 6-day: Sun) — no late; comp-off applies, not regularization
      attendanceStatus = 'present';
      isRegularized = false;
      lateByMinutes = 0;
      lateResult = { isLate: false, lateByMinutes: 0 };
    } else {
      // Working day — mark late/present; regularization is manual via /regularization
      lateResult = regularizationEngine.evaluateLateArrival(punchMeta.timestamp, shiftConfig);
      attendanceStatus = lateResult.isLate ? 'late' : 'present';
      isRegularized = false;
      lateByMinutes = lateResult.lateByMinutes;
    }
  } else if (['absent', 'week_off', 'holiday', 'on_leave'].includes(attendanceStatus)) {
    attendanceStatus = 'present';
  }

  const nextSessions = [...sessions, { punchIn: punchMeta, punchOut: null }];
  const firstPunchIn = workingHoursEngine.getFirstPunchIn({ punchSessions: nextSessions }) || punchMeta;
  const lastKnownLocation = buildLastKnownLocation(coords, 'punch');

  const updatePayload = {
    punchSessions: nextSessions,
    // Keep summary fields: first punch-in of the day; clear last punch-out while a session is open
    punchIn: firstPunchIn,
    punchOut: null,
    attendanceSource: source,
    isRegularized,
    regularizationMonthCount,
    lateByMinutes,
    attendanceStatus,
    isAutoPunchOut: false,
    updatedBy: userId,
  };

  if (lastKnownLocation) {
    updatePayload.lastKnownLocation = lastKnownLocation;
  }

  if (!record.shiftId) {
    const assignment = await EmployeeShiftAssignment.findOne(
      { employeeProfileId: profile._id, companyId, isActive: true },
      null,
      { companyId }
    );
    if (assignment?.shiftId) updatePayload.shiftId = assignment.shiftId;
  }

  const updated = await attendanceRepository.updateById(record._id, updatePayload, { companyId });

  await createAuditLog({
    companyId,
    userId,
    action: 'punch_in',
    entityType: 'attendance',
    entityId: record._id,
    req,
    metadata: {
      status: attendanceStatus,
      lateByMinutes,
      sessionIndex: nextSessions.length - 1,
      geofence: geofenceResult.skipped
        ? { skipped: true, reason: geofenceResult.reason }
        : {
            allowed: true,
            matchedOffice: geofenceResult.matchedOffice,
            distanceMeters: geofenceResult.distanceMeters,
          },
    },
  });

  return formatRecord(updated);
};

const punchOut = async (userId, companyId, req, source = 'web') => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const shiftConfig = await shiftEngine.getEmployeeShift(profile._id, companyId);
  const record = await attendanceRepository.findTodayRecord(profile._id, companyId);

  if (!record) throw ApiError.badRequest('No attendance record for today');
  if (!workingHoursEngine.hasOpenSession(record)) {
    throw ApiError.badRequest('No open punch-in session to punch out from');
  }

  const coords = extractCoords(req.body || {});
  const geofenceResult = await geofenceEngine.assertPunchAllowed(
    companyId,
    coords,
    'punch_out',
    source,
    profile._id
  );

  const punchMeta = buildPunchMeta(req, source);
  const sessions = workingHoursEngine.getSessions(record).map((s) => ({
    punchIn: s.punchIn,
    punchOut: s.punchOut || null,
  }));
  const openIndex = sessions.length - 1;
  sessions[openIndex] = { ...sessions[openIndex], punchOut: punchMeta };

  const firstPunchIn = workingHoursEngine.getFirstPunchIn({ punchSessions: sessions });
  const lastPunchOut = punchMeta;
  const tempRecord = {
    ...record.toObject(),
    punchSessions: sessions,
    punchIn: firstPunchIn,
    punchOut: lastPunchOut,
  };
  const hours = workingHoursEngine.calculateWorkingHours(tempRecord, shiftConfig);
  const hoursStatus = workingHoursEngine.determineHoursStatus(hours.netWorkingMinutes, shiftConfig);
  const isWeeklyOff = !shiftEngine.isWorkingDay(shiftConfig, record.date);

  let attendanceStatus = record.isRegularized ? 'regularized' : hoursStatus;
  // Preserve late only on working days — weekly offs never stay as late
  if (!isWeeklyOff && record.attendanceStatus === 'late' && hoursStatus === 'present') {
    attendanceStatus = 'late';
  }
  if (isWeeklyOff && !record.isRegularized) {
    attendanceStatus = hoursStatus === 'absent' ? 'absent' : 'present';
  }
  if (hoursStatus === 'half_day' && !record.isRegularized && !isWeeklyOff) attendanceStatus = 'half_day';
  if (hoursStatus === 'absent') attendanceStatus = 'absent';

  const updatePayloadExtras = isWeeklyOff ? { lateByMinutes: 0 } : {};

  try {
    const { applyAttendanceRules } = require('../policy-engine/integrations/moduleIntegration');
    const ruleResult = await applyAttendanceRules({
      companyId,
      userId,
      employeeProfileId: profile._id,
      context: {
        netWorkingMinutes: hours.netWorkingMinutes,
        grossWorkingMinutes: hours.grossWorkingMinutes,
        lateByMinutes: record.lateByMinutes || 0,
        hasPunchOut: true,
        isRegularized: record.isRegularized,
        attendanceStatus,
      },
      triggeredBy: userId,
    });
    if (ruleResult.attendanceStatus) attendanceStatus = ruleResult.attendanceStatus;
  } catch {
    // Rule engine optional — fall back to engine-calculated status
  }

  const lastKnownLocation = buildLastKnownLocation(coords, 'punch');
  const updatePayload = {
    punchSessions: sessions,
    punchIn: firstPunchIn,
    punchOut: lastPunchOut,
    ...hours,
    ...updatePayloadExtras,
    attendanceStatus,
    updatedBy: userId,
  };
  if (lastKnownLocation) {
    updatePayload.lastKnownLocation = lastKnownLocation;
  }

  const updated = await attendanceRepository.updateById(record._id, updatePayload, { companyId });

  await createAuditLog({
    companyId,
    userId,
    action: 'punch_out',
    entityType: 'attendance',
    entityId: record._id,
    req,
    metadata: {
      netWorkingMinutes: hours.netWorkingMinutes,
      status: attendanceStatus,
      sessionIndex: openIndex,
      geofence: geofenceResult.skipped
        ? { skipped: true, reason: geofenceResult.reason }
        : {
            allowed: true,
            matchedOffice: geofenceResult.matchedOffice,
            distanceMeters: geofenceResult.distanceMeters,
          },
    },
  });

  return formatRecord(updated);
};

const updateLocation = async (userId, companyId, body, req) => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const record = await attendanceRepository.findTodayRecord(profile._id, companyId);

  if (!record) throw ApiError.badRequest('No attendance record for today');
  if (!workingHoursEngine.hasOpenSession(record)) {
    throw ApiError.badRequest('Location updates are only allowed while punched in');
  }

  const coords = extractCoords(body);
  if (!coords) {
    throw ApiError.badRequest('Latitude and longitude are required');
  }

  const lastKnownLocation = buildLastKnownLocation(coords, 'heartbeat');
  const updated = await attendanceRepository.updateById(
    record._id,
    { lastKnownLocation, updatedBy: userId },
    { companyId }
  );

  await createAuditLog({
    companyId,
    userId,
    action: 'location_heartbeat',
    entityType: 'attendance',
    entityId: record._id,
    req,
    metadata: {
      latitude: coords.latitude,
      longitude: coords.longitude,
    },
  });

  return {
    lastKnownLocation: updated.lastKnownLocation,
    attendanceStatus: updated.attendanceStatus,
    hasOpenSession: true,
  };
};

const startBreak = async (userId, companyId, breakType, req) => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const record = await attendanceRepository.findTodayRecord(profile._id, companyId);
  if (!record) throw ApiError.badRequest('No attendance record for today');

  const update = breakEngine.startBreak(record, breakType);
  const updated = await attendanceRepository.updateById(record._id, update, { companyId });

  await createAuditLog({
    companyId,
    userId,
    action: 'break_start',
    entityType: 'attendance',
    entityId: record._id,
    req,
    metadata: { breakType },
  });

  return formatRecord(updated);
};

const endBreak = async (userId, companyId, breakType, req) => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const record = await attendanceRepository.findTodayRecord(profile._id, companyId);
  if (!record) throw ApiError.badRequest('No attendance record for today');

  const update = breakEngine.endBreak(record, breakType);
  const updated = await attendanceRepository.updateById(record._id, update, { companyId });

  await createAuditLog({
    companyId,
    userId,
    action: 'break_end',
    entityType: 'attendance',
    entityId: record._id,
    req,
    metadata: { breakType },
  });

  return formatRecord(updated);
};

const getTodayAttendance = async (userId, companyId) => {
  const profile = await getEmployeeProfileByUser(userId, companyId);
  const record = await attendanceRepository.findTodayRecord(profile._id, companyId);

  if (!record) {
    const assignment = await shiftEngine.getActiveShiftAssignment(profile._id, companyId);
    const shift = shiftEngine.formatShiftRef(assignment?.shiftId);
    return {
      date: getDateOnly(),
      attendanceStatus: 'absent',
      punchedIn: false,
      punchedOut: false,
      punchSessions: [],
      shift,
    };
  }

  const shiftFallback =
    record.shiftId && typeof record.shiftId === 'object' && record.shiftId.name
      ? null
      : shiftEngine.formatShiftRef(
          (await shiftEngine.getActiveShiftAssignment(profile._id, companyId))?.shiftId
        );

  const formatted = formatRecord(record, shiftFallback);
  const currentlyIn = workingHoursEngine.isCurrentlyPunchedIn(record);
  const hasAnySession = workingHoursEngine.getSessions(record).length > 0;
  const workingTimer = hasAnySession
    ? workingHoursEngine.calculateWorkingHours(
        record,
        await shiftEngine.getEmployeeShift(profile._id, companyId)
      )
    : null;

  return {
    ...formatted,
    // punchedIn = currently in an open session (can punch out)
    punchedIn: currentlyIn,
    // punchedOut = day has punches but no open session (can punch in again)
    punchedOut: hasAnySession && !currentlyIn,
    workingTimer,
  };
};

const listAttendance = async (companyId, query, requester) => {
  const filter = { companyId };
  const {
    isManagerRole,
    getTeamUserIds,
    assertTeamMemberByProfileId,
    assertTeamMemberByUserId,
  } = require('../managers/team.helper');

  if (requester && isManagerRole(requester)) {
    if (query.employeeProfileId) {
      await assertTeamMemberByProfileId(requester.id, query.employeeProfileId, companyId);
    } else if (query.userId) {
      await assertTeamMemberByUserId(requester.id, query.userId, companyId);
    } else {
      const teamUserIds = await getTeamUserIds(requester.id, companyId);
      filter.userId = { $in: teamUserIds };
    }
  }

  if (query.status) filter.attendanceStatus = query.status;
  if (query.shiftId) filter.shiftId = query.shiftId;
  if (query.userId) filter.userId = query.userId;
  if (query.employeeProfileId) filter.employeeProfileId = query.employeeProfileId;
  if (query.dateFrom || query.dateTo) {
    filter.date = {};
    if (query.dateFrom) filter.date.$gte = getDateOnly(new Date(query.dateFrom));
    if (query.dateTo) filter.date.$lte = getDateOnly(new Date(query.dateTo));
  }

  const result = await attendanceRepository.findByDateRange(filter, query, { companyId });
  const shiftCache = new Map();
  shiftCache.companyId = companyId;

  const data = await Promise.all(
    result.data.map(async (r) => {
      const hasPopulatedShift = r.shiftId && typeof r.shiftId === 'object' && r.shiftId.name;
      const shiftFallback = hasPopulatedShift
        ? null
        : await getShiftFallbackForProfile(r.employeeProfileId, shiftCache);
      return formatRecord(r, shiftFallback);
    })
  );

  return { data, meta: result.meta };
};

const correctAttendance = async (id, data, companyId, actorId, req) => {
  const record = await attendanceRepository.findById(id, null, { companyId });
  if (!record) throw ApiError.notFound('Attendance record not found');

  const updated = await attendanceRepository.updateById(id, { ...data, updatedBy: actorId }, { companyId });

  await createAuditLog({
    companyId,
    userId: actorId,
    action: 'attendance_correct',
    entityType: 'attendance',
    entityId: id,
    changes: { after: data },
    req,
  });

  return formatRecord(updated);
};

module.exports = {
  punchIn,
  punchOut,
  updateLocation,
  startBreak,
  endBreak,
  getTodayAttendance,
  listAttendance,
  correctAttendance,
  formatRecord,
};
