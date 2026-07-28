const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const departmentSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: 150,
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    description: { type: String, trim: true, maxlength: 500 },
    parentDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    headEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    isActive: { type: Boolean, default: true },
  },
  { collection: COLLECTIONS.DEPARTMENTS }
);

departmentSchema.plugin(timestampsPlugin);
departmentSchema.plugin(companyIsolationPlugin);
departmentSchema.index({ companyId: 1, code: 1 }, { unique: true });
departmentSchema.index({ companyId: 1, isActive: 1 });
departmentSchema.index({ parentDepartmentId: 1 });

module.exports = mongoose.model('Department', departmentSchema);
