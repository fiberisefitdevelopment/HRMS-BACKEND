const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, LEAVE_STATUS, APPROVAL_STAGES, HALF_DAY_SESSIONS } = require('../../constants');

const approvalSchema = new mongoose.Schema(
  {
    stage: { type: String, enum: APPROVAL_STAGES, required: true },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    comment: { type: String, trim: true, maxlength: 500 },
    actedAt: { type: Date },
  },
  { _id: false }
);

const leaveRequestSchema = new mongoose.Schema(
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
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    leaveType: { type: String, required: true, trim: true },
    leaveTypeCode: { type: String, required: true, uppercase: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    totalDays: { type: Number, required: true, min: 0.5 },
    isHalfDay: { type: Boolean, default: false },
    halfDaySession: { type: String, enum: [...HALF_DAY_SESSIONS, null], default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    attachments: [{ type: String }],
    /** Prescription file URL for medical leave (also kept in attachments) */
    prescription: { type: String, trim: true },
    appliedOn: { type: Date, default: Date.now },
    /** self = employee applied; manual_hr / manual_manager = entered on behalf and auto-approved */
    source: {
      type: String,
      enum: ['self', 'manual_hr', 'manual_manager'],
      default: 'self',
    },
    status: { type: String, enum: LEAVE_STATUS, default: 'pending' },
    currentApprovalStage: { type: String, enum: [...APPROVAL_STAGES, 'approved', null], default: 'manager' },
    approvals: [approvalSchema],
    cancelledAt: { type: Date },
    cancelledReason: { type: String, trim: true },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedReason: { type: String, trim: true },
    approvedAt: { type: Date },
    workflowInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowInstance', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.LEAVE_REQUESTS }
);

leaveRequestSchema.plugin(timestampsPlugin);
leaveRequestSchema.plugin(companyIsolationPlugin);
leaveRequestSchema.index({ companyId: 1, employeeProfileId: 1, status: 1 });
leaveRequestSchema.index({ companyId: 1, status: 1, startDate: 1 });
leaveRequestSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
leaveRequestSchema.index({ companyId: 1, departmentId: 1, status: 1 });
leaveRequestSchema.index({ companyId: 1, managerId: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
