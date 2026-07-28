const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const managerSchema = new mongoose.Schema(
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
    departmentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    directReportIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
      },
    ],
    teamSize: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    assignedAt: { type: Date, default: Date.now },
  },
  { collection: COLLECTIONS.MANAGERS }
);

managerSchema.plugin(timestampsPlugin);
managerSchema.plugin(companyIsolationPlugin);
managerSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
managerSchema.index({ companyId: 1, isActive: 1 });
managerSchema.index({ companyId: 1, departmentIds: 1 });

module.exports = mongoose.model('Manager', managerSchema);
