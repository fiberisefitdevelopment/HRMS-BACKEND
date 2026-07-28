const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const employeeShiftAssignmentSchema = new mongoose.Schema(
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
      required: true,
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
  },
  { collection: COLLECTIONS.EMPLOYEE_SHIFT_ASSIGNMENTS }
);

employeeShiftAssignmentSchema.plugin(timestampsPlugin);
employeeShiftAssignmentSchema.plugin(companyIsolationPlugin);
employeeShiftAssignmentSchema.index({ companyId: 1, employeeProfileId: 1, isActive: 1 });
employeeShiftAssignmentSchema.index({ companyId: 1, shiftId: 1 });

module.exports = mongoose.model('EmployeeShiftAssignment', employeeShiftAssignmentSchema);
