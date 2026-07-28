const regularizationEngine = require('../engines/regularization.engine');
const cron = require('node-cron');
const CompanyAttendancePolicy = require('../../attendance-policies/companyAttendancePolicy.model');
const attendanceRepository = require('../attendance.repository');
const workingHoursEngine = require('../engines/workingHours.engine');
const shiftEngine = require('../engines/shift.engine');
const {
  parseTimeToMinutes,
  getMinutesFromDate,
  getDateOnly,
  combineDateAndMinutes,
} = require('../../../utils/time');
const { createAuditLog } = require('../../../helpers/audit');
const { logger } = require('../../../config/logger');

const DEFAULT_AUTO_PUNCH_OUT_TIME = '11:00 PM';

const processAutoPunchOut = async () => {
  const now = new Date();
  const currentMinutes = getMinutesFromDate(now);
  const today = getDateOnly(now);

  const policies = await CompanyAttendancePolicy.find({ status: 'active', 'autoPunchOut.enabled': true });
  let processed = 0;
  let skippedBeforeCutoff = 0;

  for (const policy of policies) {
    const autoTime = parseTimeToMinutes(policy.autoPunchOut?.time || DEFAULT_AUTO_PUNCH_OUT_TIME);
    const candidates = await attendanceRepository.findOpenPunchRecords(policy.companyId, today);

    for (const record of candidates) {
      try {
        if (!workingHoursEngine.hasOpenSession(record)) continue;

        const recordDay = getDateOnly(record.date);
        const isToday = recordDay.getTime() === today.getTime();
        const isPastDay = recordDay.getTime() < today.getTime();

        // Same-day records: wait until configured auto punch-out time (default 11:00 PM IST).
        if (isToday && currentMinutes < autoTime) {
          skippedBeforeCutoff += 1;
          continue;
        }

        if (!isToday && !isPastDay) continue;

        const punchOutTimestamp = isPastDay
          ? combineDateAndMinutes(record.date, autoTime)
          : now;

        const shiftConfig = await shiftEngine.getEmployeeShift(record.employeeProfileId, policy.companyId);
        const punchOut = {
          timestamp: punchOutTimestamp,
          source: 'api',
          device: 'system',
          browser: 'auto-punch-out-job',
          ip: '127.0.0.1',
        };

        const sessions = workingHoursEngine.getSessions(record).map((s) => ({
          punchIn: s.punchIn,
          punchOut: s.punchOut || null,
        }));
        const openIndex = sessions.length - 1;
        sessions[openIndex] = { ...sessions[openIndex], punchOut };

        const firstPunchIn = workingHoursEngine.getFirstPunchIn({ punchSessions: sessions });
        const tempRecord = {
          ...record.toObject(),
          punchSessions: sessions,
          punchIn: firstPunchIn,
          punchOut,
        };
        const hours = workingHoursEngine.calculateWorkingHours(tempRecord, shiftConfig);
        const hoursStatus = workingHoursEngine.determineHoursStatus(hours.netWorkingMinutes, shiftConfig);
        const isWeeklyOff = !shiftEngine.isWorkingDay(shiftConfig, record.date);
        const lateResult =
          !isWeeklyOff && firstPunchIn?.timestamp
            ? regularizationEngine.evaluateLateArrival(firstPunchIn.timestamp, shiftConfig)
            : { isLate: false, lateByMinutes: 0 };

        let attendanceStatus = hoursStatus === 'absent' ? 'auto_punch_out' : hoursStatus;
        if (!isWeeklyOff && lateResult.isLate && hoursStatus === 'present') {
          attendanceStatus = 'late';
        }
        if (isWeeklyOff && hoursStatus !== 'absent') {
          attendanceStatus = 'present';
        }

        await attendanceRepository.updateById(
          record._id,
          {
            punchSessions: sessions,
            punchIn: firstPunchIn,
            punchOut,
            ...hours,
            isAutoPunchOut: true,
            lateByMinutes: isWeeklyOff ? 0 : lateResult.lateByMinutes,
            attendanceStatus,
          },
          { companyId: policy.companyId }
        );

        await createAuditLog({
          companyId: policy.companyId,
          userId: record.userId,
          action: 'auto_punch_out',
          entityType: 'attendance',
          entityId: record._id,
          metadata: {
            time: policy.autoPunchOut?.time || DEFAULT_AUTO_PUNCH_OUT_TIME,
            recordDate: recordDay.toISOString(),
            backfill: isPastDay,
          },
        });

        processed += 1;
      } catch (error) {
        logger.warn('Auto punch out failed', { recordId: record._id, error: error.message });
      }
    }
  }

  if (processed > 0 || skippedBeforeCutoff > 0) {
    logger.info('Auto punch-out job run', { processed, skippedBeforeCutoff });
  }
};

const startAutoPunchOutJob = () => {
  // Catch up missed past-day open sessions immediately on startup.
  processAutoPunchOut().catch((err) => logger.error('Auto punch out job error', { error: err.message }));

  cron.schedule('*/5 * * * *', () => {
    processAutoPunchOut().catch((err) => logger.error('Auto punch out job error', { error: err.message }));
  });
  logger.info('Auto punch-out job scheduled (every 5 minutes)');
};

module.exports = { startAutoPunchOutJob, processAutoPunchOut };
