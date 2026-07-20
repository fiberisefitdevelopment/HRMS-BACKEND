const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const WFH_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];

const wfhRequestSchema = new mongoose.Schema(
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
    date: { type: Date, required: true, index: true },
    attendanceRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceRecord',
    },
    reason: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: WFH_STATUS, default: 'pending', index: true },
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
  { collection: COLLECTIONS.WFH_REQUESTS }
);

wfhRequestSchema.plugin(timestampsPlugin);
wfhRequestSchema.plugin(companyIsolationPlugin);

wfhRequestSchema.index({ companyId: 1, employeeProfileId: 1, status: 1 });
wfhRequestSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
wfhRequestSchema.index({ companyId: 1, managerId: 1, status: 1 });

/** One pending/approved WFH request per employee per date */
wfhRequestSchema.index(
  { companyId: 1, employeeProfileId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'approved'] } },
  }
);

module.exports = mongoose.model('WfhRequest', wfhRequestSchema);
module.exports.WFH_STATUS = WFH_STATUS;
