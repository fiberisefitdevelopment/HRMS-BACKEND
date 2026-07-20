const cron = require('node-cron');
const CompanyAttendancePolicy = require('../../attendance-policies/companyAttendancePolicy.model');
const attendanceRepository = require('../attendance.repository');
const workingHoursEngine = require('../engines/workingHours.engine');
const shiftEngine = require('../engines/shift.engine');
const { parseTimeToMinutes, getMinutesFromDate, getDateOnly } = require('../../../utils/time');
const { createAuditLog } = require('../../../helpers/audit');
const { logger } = require('../../../config/logger');

const DEFAULT_AUTO_PUNCH_OUT_TIME = '11:00 PM';

const processAutoPunchOut = async () => {
  const now = new Date();
  const currentMinutes = getMinutesFromDate(now);
  const today = getDateOnly(now);

  const policies = await CompanyAttendancePolicy.find({ status: 'active', 'autoPunchOut.enabled': true });

  for (const policy of policies) {
    const autoTime = parseTimeToMinutes(policy.autoPunchOut?.time || DEFAULT_AUTO_PUNCH_OUT_TIME);
    if (currentMinutes < autoTime) continue;

    const pending = await attendanceRepository.findPendingPunchOut(policy.companyId, today);

    for (const record of pending) {
      try {
        if (!workingHoursEngine.hasOpenSession(record)) continue;

        const shiftConfig = await shiftEngine.getEmployeeShift(record.employeeProfileId, policy.companyId);
        const punchOut = {
          timestamp: now,
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

        await attendanceRepository.updateById(
          record._id,
          {
            punchSessions: sessions,
            punchIn: firstPunchIn,
            punchOut,
            ...hours,
            isAutoPunchOut: true,
            attendanceStatus: hoursStatus === 'absent' ? 'auto_punch_out' : hoursStatus,
          },
          { companyId: policy.companyId }
        );

        await createAuditLog({
          companyId: policy.companyId,
          userId: record.userId,
          action: 'auto_punch_out',
          entityType: 'attendance',
          entityId: record._id,
          metadata: { time: policy.autoPunchOut?.time || DEFAULT_AUTO_PUNCH_OUT_TIME },
        });
      } catch (error) {
        logger.warn('Auto punch out failed', { recordId: record._id, error: error.message });
      }
    }
  }
};

const startAutoPunchOutJob = () => {
  cron.schedule('*/5 * * * *', () => {
    processAutoPunchOut().catch((err) => logger.error('Auto punch out job error', { error: err.message }));
  });
  logger.info('Auto punch-out job scheduled (every 5 minutes)');
};

module.exports = { startAutoPunchOutJob, processAutoPunchOut };
