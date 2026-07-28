const ApiError = require('../../utils/ApiError');
const { createAuditLog } = require('../../helpers/audit');
const { getDateOnly, formatDateOnly, formatDateTimeIST, formatTimeIST } = require('../../utils/time');
const attendanceRepository = require('./attendance.repository');
const shiftEngine = require('./engines/shift.engine');
const breakEngine = require('./engines/break.engine');
const workingHoursEngine = require('./engines/workingHours.engine');
const regularizationEngine = require('./engines/regularization.engine');
const geofenceEngine = require('./engines/geofence.engine');
const locationEngine = require('./engines/location.engine');
const { getEmployeeProfileByUser } = require('./attendance.helper');
const EmployeeShiftAssignment = require('../shifts/employeeShiftAssignment.model');

const formatPunchMeta = (meta) => {
  if (!meta) return null;
  const plain = meta.toObject?.() || meta;
  if (!plain.timestamp) return { ...plain, timestamp: null, timestampDisplay: null };
  return {
    ...plain,
    timestamp: formatDateTimeIST(plain.timestamp),
    timestampDisplay: formatTimeIST(plain.timestamp),
  };
};

const formatInstant = (value) => (value ? formatDateTimeIST(value) : null);
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

const formatId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value._id ?? value.id ?? null;
  return value;
};

const formatUserRef = (user) => {
  if (!user || typeof user !== 'object') return null;
  const id = user._id ?? user.id;
  if (!id) return null;
  return {
    id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    email: user.email,
  };
};

const formatEmployeeRef = (profile, user) => {
  if (!profile || typeof profile !== 'object') return null;
  const id = profile._id ?? profile.id;
  if (!id) return null;
  const userRef = formatUserRef(user);
  return {
    id,
    employeeId: profile.employeeId || null,
    fullName: userRef?.fullName || null,
    email: userRef?.email || null,
  };
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
  const employee = formatEmployeeRef(r.employeeProfileId, r.userId);
  const user = formatUserRef(r.userId);

  return {
    id: r._id,
    employeeId: employee?.employeeId || null,
    employeeProfileId: formatId(r.employeeProfileId),
    userId: formatId(r.userId),
    employee,
    user,
    shiftId: shiftIdValue,
    shift,
    date: r.date ? formatDateOnly(r.date) : null,
    punchIn: formatPunchMeta(workingHoursEngine.getFirstPunchIn(r)),
    punchOut: workingHoursEngine.hasOpenSession(r)
      ? null
      : formatPunchMeta(workingHoursEngine.getLastPunchOut(r)),
    punchSessions: workingHoursEngine.getSessions(r).map((s) => ({
      punchIn: formatPunchMeta(s.punchIn || null),
      punchOut: formatPunchMeta(s.punchOut || null),
    })),
    lunchStart: formatInstant(r.lunchStart),
    lunchEnd: formatInstant(r.lunchEnd),
    teaBreak1Start: formatInstant(r.teaBreak1Start),
    teaBreak1End: formatInstant(r.teaBreak1End),
    teaBreak2Start: formatInstant(r.teaBreak2Start),
    teaBreak2End: formatInstant(r.teaBreak2End),
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
    lastKnownLocation: (() => {
      const loc = locationEngine.resolveDisplayLocation(r);
      if (!loc) return null;
      return {
        ...loc,
        recordedAt: loc.recordedAt ? formatDateTimeIST(loc.recordedAt) : null,
      };
    })(),
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
    date: getDateOnly(record.date || punchMeta.timestamp),
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
  const lateResult =
    !isWeeklyOff && firstPunchIn?.timestamp
      ? regularizationEngine.evaluateLateArrival(firstPunchIn.timestamp, shiftConfig)
      : { isLate: false, lateByMinutes: 0 };

  // Preserve / correct late on working days — late is orthogonal to full-day hours
  if (!isWeeklyOff && !record.isRegularized && lateResult.isLate && hoursStatus === 'present') {
    attendanceStatus = 'late';
  }
  if (isWeeklyOff && !record.isRegularized) {
    attendanceStatus = hoursStatus === 'absent' ? 'absent' : 'present';
  }
  if (hoursStatus === 'half_day' && !record.isRegularized && !isWeeklyOff) attendanceStatus = 'half_day';
  if (hoursStatus === 'absent') attendanceStatus = 'absent';

  const updatePayloadExtras = isWeeklyOff
    ? { lateByMinutes: 0 }
    : { lateByMinutes: lateResult.lateByMinutes };

  try {
    const { applyAttendanceRules } = require('../policy-engine/integrations/moduleIntegration');
    const ruleResult = await applyAttendanceRules({
      companyId,
      userId,
      employeeProfileId: profile._id,
      context: {
        netWorkingMinutes: hours.netWorkingMinutes,
        grossWorkingMinutes: hours.grossWorkingMinutes,
        lateByMinutes: updatePayloadExtras.lateByMinutes || 0,
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

  // Hours-based policy rules must never wipe a late arrival to present
  if (
    !isWeeklyOff &&
    !record.isRegularized &&
    lateResult.isLate &&
    attendanceStatus === 'present'
  ) {
    attendanceStatus = 'late';
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

  if (!locationEngine.shouldAcceptHeartbeatUpdate(record.lastKnownLocation, coords, record)) {
    const resolvedLocation = locationEngine.resolveDisplayLocation(record);
    return {
      lastKnownLocation: resolvedLocation,
      attendanceStatus: record.attendanceStatus,
      hasOpenSession: true,
      locationSkipped: true,
      reason: 'heartbeat_accuracy_or_distance_rejected',
    };
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
      date: formatDateOnly(getDateOnly()),
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
  const shiftConfig = await shiftEngine.getEmployeeShift(profile._id, companyId);
  const workingTimer = hasAnySession
    ? workingHoursEngine.calculateWorkingHours(record, shiftConfig)
    : null;

  // Heal stale present/late fields (e.g. punched under UTC clock math or drifted summary)
  let healed = formatted;
  const firstPunchIn = workingHoursEngine.getFirstPunchIn(record);
  if (
    firstPunchIn?.timestamp &&
    !record.isRegularized &&
    shiftEngine.isWorkingDay(shiftConfig, record.date || firstPunchIn.timestamp)
  ) {
    const lateResult = regularizationEngine.evaluateLateArrival(firstPunchIn.timestamp, shiftConfig);
    const dateNorm = getDateOnly(record.date || firstPunchIn.timestamp);
    const needsStatusHeal =
      lateResult.isLate &&
      record.attendanceStatus !== 'late' &&
      !['half_day', 'absent', 'on_leave', 'holiday'].includes(record.attendanceStatus);
    const needsLateMinutesHeal = (record.lateByMinutes || 0) !== lateResult.lateByMinutes;
    const needsDateHeal = getDateOnly(record.date).getTime() !== dateNorm.getTime();

    if (needsStatusHeal || needsLateMinutesHeal || needsDateHeal) {
      const patch = {
        date: dateNorm,
        lateByMinutes: lateResult.lateByMinutes,
        punchIn: firstPunchIn,
      };
      if (needsStatusHeal) patch.attendanceStatus = 'late';
      const updated = await attendanceRepository.updateById(record._id, patch, { companyId });
      healed = formatRecord(updated, shiftFallback);
    }
  }

  return {
    ...healed,
    // punchedIn = currently in an open session (can punch out)
    punchedIn: currentlyIn,
    // punchedOut = day has punches but no open session (can punch in again)
    punchedOut: hasAnySession && !currentlyIn,
    workingTimer,
  };
};

const listAttendance = async (companyId, query, requester) => {
  const filter = { companyId };
  const EmployeeProfile = require('../employees/employeeProfile.model');
  const {
    isManagerRole,
    getTeamUserIdsIncludingSelf,
    assertTeamMemberByProfileId,
    assertTeamMemberByUserId,
    isSelfProfile,
  } = require('../managers/team.helper');

  if (query.employeeId) {
    const profile = await EmployeeProfile.findOne(
      { companyId, employeeId: String(query.employeeId).toUpperCase(), isDeleted: false },
      null,
      { companyId }
    );
    if (!profile) throw ApiError.notFound('Employee not found');
    if (requester && isManagerRole(requester) && !isSelfProfile(profile, requester.id)) {
      await assertTeamMemberByProfileId(requester.id, profile._id, companyId);
    }
    filter.employeeProfileId = profile._id;
  }

  if (requester && isManagerRole(requester)) {
    if (query.scope === 'self') {
      filter.userId = requester.id;
    } else if (query.employeeProfileId) {
      const profile = await EmployeeProfile.findOne(
        { _id: query.employeeProfileId, companyId, isDeleted: false },
        null,
        { companyId }
      );
      if (!profile) throw ApiError.notFound('Employee not found');
      if (!isSelfProfile(profile, requester.id)) {
        await assertTeamMemberByProfileId(requester.id, query.employeeProfileId, companyId);
      }
    } else if (query.userId) {
      if (query.userId.toString() !== requester.id.toString()) {
        await assertTeamMemberByUserId(requester.id, query.userId, companyId);
      }
    } else if (!filter.employeeProfileId) {
      const teamUserIds = await getTeamUserIdsIncludingSelf(requester.id, companyId);
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

  const listQuery = { ...query };
  if (!listQuery.sort) {
    listQuery.sort =
      query.employeeId || query.employeeProfileId || query.userId ? '-date' : 'employeeProfileId,-date';
  }

  const result = await attendanceRepository.findByDateRange(filter, listQuery, { companyId });
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

const buildCorrectionPatch = (data, actorId) => {
  const patch = {
    updatedBy: actorId,
    attendanceSource: 'manual',
  };

  if (data.attendanceStatus != null) patch.attendanceStatus = data.attendanceStatus;
  if (data.remarks != null) patch.remarks = data.remarks;

  if (data.punchIn?.timestamp) {
    patch.punchIn = {
      timestamp: data.punchIn.timestamp,
      source: 'manual',
    };
  }
  if (data.punchOut?.timestamp) {
    patch.punchOut = {
      timestamp: data.punchOut.timestamp,
      source: 'manual',
    };
  }

  if (patch.punchIn || patch.punchOut) {
    const punchIn = patch.punchIn || undefined;
    const punchOut = patch.punchOut || undefined;
    if (punchIn) {
      patch.punchSessions = [{ punchIn, punchOut: punchOut || null }];
    }
  }

  return patch;
};

const auditCorrectionSnapshot = (record) => ({
  attendanceStatus: record?.attendanceStatus || null,
  remarks: record?.remarks || null,
  punchIn: record?.punchIn?.timestamp || null,
  punchOut: record?.punchOut?.timestamp || null,
});

const correctAttendance = async (id, data, companyId, actorId, req) => {
  const record = await attendanceRepository.findById(id, null, { companyId });
  if (!record) throw ApiError.notFound('Attendance record not found');

  const before = auditCorrectionSnapshot(record);
  const patch = buildCorrectionPatch(data, actorId);
  const updated = await attendanceRepository.updateById(id, patch, { companyId });

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: record.userId,
    action: 'attendance_correct',
    entityType: 'attendance',
    entityId: id,
    changes: { before, after: auditCorrectionSnapshot(updated) },
    metadata: {
      reason: data.remarks || updated.remarks || null,
      status: updated.attendanceStatus,
      date: updated.date ? formatDateOnly(updated.date) : null,
      employeeProfileId: String(record.employeeProfileId),
    },
    req,
  });

  return formatRecord(updated);
};

const correctAttendanceByDate = async (data, companyId, actorId, req) => {
  const EmployeeProfile = require('../employees/employeeProfile.model');
  const profile = await EmployeeProfile.findOne(
    { _id: data.employeeProfileId, companyId, isDeleted: false },
    null,
    { companyId }
  ).populate('userId', 'firstName lastName fullName email');

  if (!profile) throw ApiError.notFound('Employee not found');

  const date = getDateOnly(data.date);
  let record = await attendanceRepository.findTodayRecord(profile._id, companyId, date);
  const before = record ? auditCorrectionSnapshot(record) : null;
  const patch = buildCorrectionPatch(data, actorId);

  if (!record) {
    const assignment = await EmployeeShiftAssignment.findOne(
      { employeeProfileId: profile._id, companyId, isActive: true },
      null,
      { companyId }
    );

    record = await attendanceRepository.create({
      companyId,
      employeeProfileId: profile._id,
      userId: profile.userId?._id || profile.userId,
      shiftId: assignment?.shiftId,
      date,
      attendanceStatus: data.attendanceStatus,
      attendanceSource: 'manual',
      remarks: data.remarks,
      ...(patch.punchIn ? { punchIn: patch.punchIn } : {}),
      ...(patch.punchOut ? { punchOut: patch.punchOut } : {}),
      ...(patch.punchSessions ? { punchSessions: patch.punchSessions } : {}),
      createdBy: actorId,
      updatedBy: actorId,
    });
  } else {
    record = await attendanceRepository.updateById(record._id, patch, { companyId });
  }

  await createAuditLog({
    companyId,
    userId: actorId,
    subjectUserId: profile.userId?._id || profile.userId,
    action: 'attendance_correct',
    entityType: 'attendance',
    entityId: record._id,
    changes: { before, after: auditCorrectionSnapshot(record) },
    metadata: {
      reason: data.remarks,
      status: record.attendanceStatus,
      date: formatDateOnly(date),
      employeeProfileId: String(profile._id),
      employeeId: profile.employeeId,
    },
    req,
  });

  return formatRecord(record);
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
  correctAttendanceByDate,
  formatRecord,
};
