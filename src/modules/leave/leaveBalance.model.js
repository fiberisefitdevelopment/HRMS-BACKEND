const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const leaveBalanceSchema = new mongoose.Schema(
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
    },
    leaveType: { type: String, required: true, trim: true },
    leaveTypeCode: { type: String, required: true, uppercase: true, trim: true },
    balance: { type: Number, required: true, default: 0 },
    lastCreditedAt: { type: Date },
    lastDebitedAt: { type: Date },
    lastTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveLedger' },
  },
  { collection: COLLECTIONS.LEAVE_BALANCES }
);

leaveBalanceSchema.plugin(timestampsPlugin);
leaveBalanceSchema.plugin(companyIsolationPlugin);
leaveBalanceSchema.index({ companyId: 1, employeeProfileId: 1, leaveTypeCode: 1 }, { unique: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
