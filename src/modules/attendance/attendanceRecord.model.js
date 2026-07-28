const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, ATTENDANCE_STATUS, ATTENDANCE_SOURCE } = require('../../constants');

const punchMetaSchema = new mongoose.Schema(
  {
    timestamp: { type: Date },
    source: { type: String, enum: ATTENDANCE_SOURCE, default: 'web' },
    device: { type: String },
    browser: { type: String },
    ip: { type: String },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    accuracyMeters: { type: Number, min: 0 },
  },
  { _id: false }
);

const lastKnownLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    accuracyMeters: { type: Number, min: 0 },
    recordedAt: { type: Date, required: true },
    source: { type: String, enum: ['punch', 'heartbeat'], default: 'punch' },
  },
  { _id: false }
);

const attendanceRecordSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    employeeProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeProfile',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
    },
    date: {
      type: Date,
      required: true,
    },
    punchIn: punchMetaSchema,
    punchOut: punchMetaSchema,
    // Multiple in/out cycles per day. punchIn/punchOut stay as first-in / last-out summaries.
    punchSessions: {
      type: [
        {
          punchIn: punchMetaSchema,
          punchOut: punchMetaSchema,
        },
      ],
      default: [],
    },
    lastKnownLocation: lastKnownLocationSchema,
    lunchStart: { type: Date },
    lunchEnd: { type: Date },
    teaBreak1Start: { type: Date },
    teaBreak1End: { type: Date },
    teaBreak2Start: { type: Date },
    teaBreak2End: { type: Date },
    grossWorkingMinutes: { type: Number, default: 0, min: 0 },
    breakDurationMinutes: { type: Number, default: 0, min: 0 },
    netWorkingMinutes: { type: Number, default: 0, min: 0 },
    lateByMinutes: { type: Number, default: 0, min: 0 },
    earlyExitMinutes: { type: Number, default: 0, min: 0 },
    isRegularized: { type: Boolean, default: false },
    regularizationMonthCount: { type: Number },
    attendanceStatus: {
      type: String,
      enum: ATTENDANCE_STATUS,
      default: 'absent',
    },
    attendanceSource: {
      type: String,
      enum: ATTENDANCE_SOURCE,
      default: 'web',
    },
    locationKey: { type: String, trim: true },
    isAutoPunchOut: { type: Boolean, default: false },
    remarks: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.ATTENDANCE }
);

attendanceRecordSchema.plugin(timestampsPlugin);
attendanceRecordSchema.plugin(companyIsolationPlugin);
attendanceRecordSchema.index({ companyId: 1, employeeProfileId: 1, date: 1 }, { unique: true });
attendanceRecordSchema.index({ companyId: 1, date: 1, attendanceStatus: 1 });
attendanceRecordSchema.index({ companyId: 1, userId: 1, date: -1 });
attendanceRecordSchema.index({ companyId: 1, shiftId: 1, date: 1 });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
