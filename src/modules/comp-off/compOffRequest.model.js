const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const COMP_OFF_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];
const REQUESTED_DAYS = [0.5, 1];

const compOffRequestSchema = new mongoose.Schema(
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
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    attendanceDate: { type: Date, required: true, index: true },
    attendanceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceRecord',
      required: true,
    },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    shiftEndTime: { type: Date, required: true },
    punchOutAt: { type: Date, required: true },
    overtimeMinutes: { type: Number, required: true, min: 0 },
    /** overtime = after shift end on a working day; weekly_off = worked on a non-working day */
    eligibilityType: {
      type: String,
      enum: ['overtime', 'weekly_off'],
      required: true,
    },
    requestedDays: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => v === 0.5 || v === 1,
        message: 'requestedDays must be 0.5 or 1',
      },
    },
    reason: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: COMP_OFF_STATUS, default: 'pending', index: true },
    workflowInstanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkflowInstance',
      index: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    approvedComment: { type: String, trim: true, maxlength: 500 },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedReason: { type: String, trim: true, maxlength: 500 },
    cancelledAt: { type: Date },
    cancelledReason: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.COMP_OFF_REQUESTS }
);

compOffRequestSchema.plugin(timestampsPlugin);
compOffRequestSchema.plugin(companyIsolationPlugin);

compOffRequestSchema.index({ companyId: 1, employeeProfileId: 1, status: 1 });
compOffRequestSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
compOffRequestSchema.index({ companyId: 1, managerId: 1, status: 1 });

/** One pending/approved request per employee per attendance date */
compOffRequestSchema.index(
  { companyId: 1, employeeProfileId: 1, attendanceDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'approved'] } },
  }
);

module.exports = mongoose.model('CompOffRequest', compOffRequestSchema);
module.exports.COMP_OFF_STATUS = COMP_OFF_STATUS;
module.exports.REQUESTED_DAYS = REQUESTED_DAYS;
