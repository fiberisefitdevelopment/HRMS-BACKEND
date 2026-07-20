const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const timeWindowSchema = new mongoose.Schema(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false }
);

const breakRuleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['lunch', 'tea_break_1', 'tea_break_2'], required: true },
    start: { type: String },
    end: { type: String },
    durationMinutes: { type: Number, default: 15 },
    isMandatory: { type: Boolean, default: false },
  },
  { _id: false }
);

const companyAttendancePolicySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, default: 'Default Policy' },
    isDefault: { type: Boolean, default: true },
    officeTimings: {
      defaultStart: { type: String, default: '09:00 AM' },
      defaultEnd: { type: String, default: '06:00 PM' },
    },
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5],
    },
    gracePeriodMinutes: { type: Number, default: 15 },
    regularization: {
      enabled: { type: Boolean, default: true },
      windowStart: { type: String, default: '09:15 AM' },
      windowEnd: { type: String, default: '09:30 AM' },
      monthlyLimit: { type: Number, default: 2 },
      exceedingAction: { type: String, enum: ['half_day', 'late', 'absent'], default: 'half_day' },
    },
    dailyWageBuffer: {
      enabled: { type: Boolean, default: false },
      windowStart: { type: String, default: '09:00 AM' },
      windowEnd: { type: String, default: '09:30 AM' },
    },
    workingHours: {
      fullDayMinutes: { type: Number, default: 510 },
      halfDayMinutes: { type: Number, default: 270 },
    },
    breaks: {
      rules: [breakRuleSchema],
    },
    latePolicy: {
      enabled: { type: Boolean, default: true },
      gracePeriodMinutes: { type: Number, default: 15 },
      markAsLateAfterGrace: { type: Boolean, default: true },
    },
    missingPunchRules: {
      markAbsentIfNoPunchIn: { type: Boolean, default: true },
      markMissingPunchIfNoPunchOut: { type: Boolean, default: true },
    },
    autoPunchOut: {
      enabled: { type: Boolean, default: true },
      time: { type: String, default: '11:00 PM' },
    },
    futureSettings: {
      workFromHomeEnabled: { type: Boolean, default: true },
      outdoorDutyEnabled: { type: Boolean, default: false },
    },
    geofencing: {
      enabled: { type: Boolean, default: false },
      enforceOnPunchIn: { type: Boolean, default: true },
      enforceOnPunchOut: { type: Boolean, default: true },
      /** When true (default), all employees are enforced. When false, only employeeProfileIds. */
      applyToAllEmployees: { type: Boolean, default: true },
      employeeProfileIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'EmployeeProfile',
        },
      ],
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.COMPANY_ATTENDANCE_POLICIES }
);

companyAttendancePolicySchema.plugin(timestampsPlugin);
companyAttendancePolicySchema.plugin(companyIsolationPlugin);
companyAttendancePolicySchema.index({ companyId: 1, isDefault: 1 });
companyAttendancePolicySchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('CompanyAttendancePolicy', companyAttendancePolicySchema);
