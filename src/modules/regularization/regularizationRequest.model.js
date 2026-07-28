const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const REGULARIZATION_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];

const regularizationRequestSchema = new mongoose.Schema(
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
    originalPunchInAt: { type: Date, required: true },
    originalPunchOutAt: { type: Date },
    originalStatus: { type: String },
    requestedPunchInAt: { type: Date },
    requestedPunchOutAt: { type: Date },
    lateByMinutes: { type: Number, default: 0, min: 0 },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: REGULARIZATION_STATUS, default: 'pending', index: true },
    appliedStatus: { type: String },
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
  { collection: COLLECTIONS.REGULARIZATION_REQUESTS }
);

regularizationRequestSchema.plugin(timestampsPlugin);
regularizationRequestSchema.plugin(companyIsolationPlugin);

regularizationRequestSchema.index({ companyId: 1, employeeProfileId: 1, status: 1 });
regularizationRequestSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
regularizationRequestSchema.index({ companyId: 1, managerId: 1, status: 1 });

/** One pending/approved request per employee per attendance date */
regularizationRequestSchema.index(
  { companyId: 1, employeeProfileId: 1, attendanceDate: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'approved'] } },
  }
);

module.exports = mongoose.model('RegularizationRequest', regularizationRequestSchema);
module.exports.REGULARIZATION_STATUS = REGULARIZATION_STATUS;
