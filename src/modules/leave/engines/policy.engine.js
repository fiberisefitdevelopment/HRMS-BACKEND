const policyRepository = require('../../leave-policies/policy.repository');
const ApiError = require('../../../utils/ApiError');
const { LEAVE_TYPES } = require('../../../constants');
const { getDateOnly, getDayOfWeek, isSameDay } = require('../../../utils/time');

const getPolicy = async (companyId) => {
  const policy = await policyRepository.findDefault(companyId);
  if (!policy) throw ApiError.notFound('Leave policy not found');
  return policy;
};

const getLeaveTypeConfig = (policy, leaveTypeCode) => {
  const code = leaveTypeCode.toUpperCase();
  const config = policy.leaveTypes.find((lt) => lt.code === code && lt.isActive);
  if (!config) throw ApiError.badRequest(`Leave type ${code} is not configured or inactive`);
  return config;
};

const resolveLeaveTypeCode = (input) => {
  const upper = input.toUpperCase();
  if (LEAVE_TYPES[upper]) return { code: upper, leaveType: LEAVE_TYPES[upper] };
  const entry = Object.entries(LEAVE_TYPES).find(([, v]) => v === input);
  if (entry) return { code: entry[0], leaveType: entry[1] };
  throw ApiError.badRequest(`Invalid leave type: ${input}`);
};

const isHoliday = (policy, date) => {
  const day = getDateOnly(date);
  return (policy.holidays || []).some((h) => h?.date && isSameDay(h.date, day));
};

const isWorkingDayForLeave = (policy, date) => {
  const dayIndex = getDayOfWeek(date);
  const workingDays = policy.workingDaysForLeave?.workingDays || [1, 2, 3, 4, 5];
  if (policy.workingDaysForLeave?.excludeWeekends && (dayIndex === 0 || dayIndex === 6)) {
    return false;
  }
  return workingDays.includes(dayIndex);
};

const getCreditTypesForCycle = (policy, cycle) =>
  policy.leaveTypes.filter((lt) => lt.isActive && lt.creditCycle === cycle);

module.exports = {
  getPolicy,
  getLeaveTypeConfig,
  resolveLeaveTypeCode,
  isHoliday,
  isWorkingDayForLeave,
  getCreditTypesForCycle,
};
