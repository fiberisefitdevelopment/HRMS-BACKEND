const RegularizationCounter = require('../regularizationCounter.model');
const { getMonthYear, getMinutesFromDate, parseTimeToMinutes, isWithinWindow } = require('../../../utils/time');

const getOrCreateCounter = async (companyId, employeeProfileId, userId, date) => {
  const { year, month } = getMonthYear(date);
  const counter = await RegularizationCounter.findOneAndUpdate(
    { companyId, employeeProfileId, year, month },
    { $setOnInsert: { userId, count: 0 } },
    { new: true, upsert: true, companyId }
  );
  return counter;
};

const evaluateRegularization = async (punchInTime, shiftConfig, companyId, employeeProfileId, userId) => {
  const reg = shiftConfig.regularization;
  if (!reg?.enabled) return { applies: false };

  const punchMinutes = getMinutesFromDate(punchInTime);
  const windowStart = parseTimeToMinutes(reg.windowStart);
  const windowEnd = parseTimeToMinutes(reg.windowEnd);

  if (!isWithinWindow(punchMinutes, windowStart, windowEnd)) {
    return { applies: false };
  }

  const counter = await getOrCreateCounter(companyId, employeeProfileId, userId, punchInTime);
  const newCount = counter.count + 1;

  if (newCount <= reg.monthlyLimit) {
    await RegularizationCounter.updateOne({ _id: counter._id }, { $inc: { count: 1 } });
    return { applies: true, isRegularized: true, status: 'regularized', monthCount: newCount };
  }

  await RegularizationCounter.updateOne({ _id: counter._id }, { $inc: { count: 1 } });
  const exceedingAction = reg.exceedingAction || 'half_day';
  return {
    applies: true,
    isRegularized: false,
    status: exceedingAction === 'half_day' ? 'half_day' : exceedingAction,
    monthCount: newCount,
  };
};

const evaluateLateArrival = (punchInTime, shiftConfig) => {
  const punchMinutes = getMinutesFromDate(punchInTime);
  const shiftStart = Number(shiftConfig.shiftStartMinutes) || 0;
  const grace =
    shiftConfig.gracePeriodMinutes ?? shiftConfig.latePolicy?.gracePeriodMinutes ?? 0;
  const lateThreshold = shiftStart + Number(grace || 0);

  if (punchMinutes <= lateThreshold) {
    return { isLate: false, lateByMinutes: 0 };
  }

  const lateByMinutes = punchMinutes - shiftStart;
  const policyEnabled = shiftConfig.latePolicy?.enabled !== false;
  const markAsLate = shiftConfig.latePolicy?.markAsLateAfterGrace !== false;

  if (!policyEnabled || !markAsLate) {
    return { isLate: false, lateByMinutes };
  }

  return { isLate: true, lateByMinutes };
};

module.exports = {
  getOrCreateCounter,
  evaluateRegularization,
  evaluateLateArrival,
};
