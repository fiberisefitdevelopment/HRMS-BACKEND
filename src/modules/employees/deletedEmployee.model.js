const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const deletedEmployeeSchema = new mongoose.Schema(
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
    employeeId: { type: String, required: true, trim: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    fullName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    officialEmail: { type: String, trim: true, lowercase: true },
    departmentName: { type: String, trim: true },
    designationName: { type: String, trim: true },
    employmentType: { type: String, trim: true },
    joiningDate: { type: Date },
    profilePhoto: { type: String, trim: true },
    previousStatus: { type: String, trim: true },
    previousUserActive: { type: Boolean, default: true },
    previousUserStatus: { type: String, trim: true },
    previousUserBlocked: { type: Boolean, default: false },
    previousBlockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    previousBlockedReason: { type: String, trim: true },
    previousBlockedAt: { type: Date },
    profileSnapshot: { type: mongoose.Schema.Types.Mixed },
    deletedAt: { type: Date, required: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.DELETED_EMPLOYEES }
);

deletedEmployeeSchema.plugin(timestampsPlugin);
deletedEmployeeSchema.plugin(companyIsolationPlugin);
deletedEmployeeSchema.index({ companyId: 1, employeeProfileId: 1 }, { unique: true });
deletedEmployeeSchema.index({ companyId: 1, deletedAt: -1 });
deletedEmployeeSchema.index({ companyId: 1, fullName: 1, employeeId: 1, email: 1 });

module.exports = mongoose.model('DeletedEmployee', deletedEmployeeSchema);
