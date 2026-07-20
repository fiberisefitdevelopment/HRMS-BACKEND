const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, PAYROLL_STATUS } = require('../../constants');

const salaryComponentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['earning', 'deduction'], required: true },
    isTaxable: { type: Boolean, default: true },
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee ID is required'],
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    earnings: [salaryComponentSchema],
    deductions: [salaryComponentSchema],
    grossPay: { type: Number, required: true, min: 0 },
    totalDeductions: { type: Number, default: 0, min: 0 },
    netPay: { type: Number, required: true, min: 0 },
    workingDays: { type: Number, min: 0 },
    presentDays: { type: Number, min: 0 },
    status: {
      type: String,
      enum: PAYROLL_STATUS,
      default: 'draft',
    },
    processedAt: { type: Date },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { collection: COLLECTIONS.PAYROLL }
);

payrollSchema.plugin(timestampsPlugin);
payrollSchema.plugin(companyIsolationPlugin);
payrollSchema.index({ companyId: 1, employeeId: 1, month: 1, year: 1 }, { unique: true });
payrollSchema.index({ companyId: 1, year: 1, month: 1, status: 1 });
payrollSchema.index({ companyId: 1, employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('Payroll', payrollSchema);
