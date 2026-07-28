const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, CREDIT_CYCLES, APPROVAL_STAGES, LEAVE_TYPE_CODES } = require('../../constants');

const leaveTypeConfigSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, enum: LEAVE_TYPE_CODES, uppercase: true },
    name: { type: String, required: true, trim: true },
    leaveType: { type: String, required: true, trim: true },
    creditAmount: { type: Number, default: 0, min: 0 },
    creditCycle: { type: String, enum: CREDIT_CYCLES, default: 'yearly' },
    maxBalance: { type: Number, min: 0 },
    carryForward: { type: Boolean, default: false },
    carryForwardLimit: { type: Number, min: 0 },
    requiresAttachment: { type: Boolean, default: false },
    allowNegativeBalance: { type: Boolean, default: false },
    expiryMonths: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
    approvalFlow: { type: [String], enum: APPROVAL_STAGES, default: ['manager', 'hr'] },
  },
  { _id: false }
);

const companyLeavePolicySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: true },
    leaveTypes: [leaveTypeConfigSchema],
    shortLeave: {
      monthlyAllowance: { type: Number, default: 1, min: 0 },
      autoDeduct: { type: Boolean, default: true },
      resetMonthly: { type: Boolean, default: true },
    },
    approvalWorkflow: {
      stages: { type: [String], enum: APPROVAL_STAGES, default: ['manager', 'hr'] },
      hrFinalApproval: { type: Boolean, default: true },
    },
    workingDaysForLeave: {
      excludeWeekends: { type: Boolean, default: false },
      workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    },
    holidays: [{ date: Date, name: String }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.COMPANY_LEAVE_POLICIES }
);

companyLeavePolicySchema.plugin(timestampsPlugin);
companyLeavePolicySchema.plugin(companyIsolationPlugin);
companyLeavePolicySchema.index({ companyId: 1, isDefault: 1 });
companyLeavePolicySchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('CompanyLeavePolicy', companyLeavePolicySchema);
