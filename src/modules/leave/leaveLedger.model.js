const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, LEDGER_TRANSACTION_TYPES } = require('../../constants');

const leaveLedgerSchema = new mongoose.Schema(
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
    transactionType: { type: String, enum: LEDGER_TRANSACTION_TYPES, required: true },
    openingBalance: { type: Number, required: true, default: 0 },
    credit: { type: Number, default: 0, min: 0 },
    debit: { type: Number, default: 0, min: 0 },
    adjustment: { type: Number, default: 0 },
    closingBalance: { type: Number, required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    referenceType: { type: String, trim: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    transactionDate: { type: Date, required: true, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.LEAVE_LEDGER }
);

leaveLedgerSchema.plugin(timestampsPlugin);
leaveLedgerSchema.plugin(companyIsolationPlugin);
leaveLedgerSchema.index({ companyId: 1, employeeProfileId: 1, leaveTypeCode: 1, transactionDate: -1 });
leaveLedgerSchema.index({ companyId: 1, referenceType: 1, referenceId: 1 });

module.exports = mongoose.model('LeaveLedger', leaveLedgerSchema);
