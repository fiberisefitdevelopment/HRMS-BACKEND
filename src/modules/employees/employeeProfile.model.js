const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, EMPLOYMENT_TYPES, EMPLOYMENT_STATUS } = require('../../constants');

const employeeProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    designationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation',
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      uppercase: true,
      trim: true,
    },
    joiningDate: { type: Date, required: [true, 'Joining date is required'] },
    confirmationDate: { type: Date },
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      default: 'full_time',
    },
    workLocation: { type: String, trim: true },
    officeLocation: { type: String, trim: true },
    salaryStructureId: { type: mongoose.Schema.Types.ObjectId },
    shiftId: { type: mongoose.Schema.Types.ObjectId },
    bloodGroup: { type: String, trim: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    },
    dateOfBirth: { type: Date },
    maritalStatus: {
      type: String,
      enum: ['single', 'married', 'divorced', 'widowed'],
    },
    nationality: { type: String, trim: true, default: 'Indian' },
    personalEmail: { type: String, trim: true, lowercase: true },
    officialEmail: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    emergencyContactName: { type: String, trim: true },
    emergencyContactNumber: { type: String, trim: true },
    relation: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    pincode: { type: String, trim: true },
    aadhaarNumber: { type: String, trim: true, select: false },
    panNumber: { type: String, trim: true, uppercase: true, select: false },
    passportNumber: { type: String, trim: true, select: false },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true, select: false },
    ifscCode: { type: String, trim: true, uppercase: true },
    uan: { type: String, trim: true },
    pfNumber: { type: String, trim: true },
    esiNumber: { type: String, trim: true },
    profilePhoto: { type: String, trim: true },
    status: {
      type: String,
      enum: EMPLOYMENT_STATUS,
      default: 'active',
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.EMPLOYEE_PROFILES }
);

employeeProfileSchema.plugin(timestampsPlugin);
employeeProfileSchema.plugin(companyIsolationPlugin);
employeeProfileSchema.index({ companyId: 1, employeeId: 1 }, { unique: true });
employeeProfileSchema.index({ companyId: 1, userId: 1 }, { unique: true });
employeeProfileSchema.index({ companyId: 1, officialEmail: 1 }, { unique: true, sparse: true });
employeeProfileSchema.index({ companyId: 1, departmentId: 1 });
employeeProfileSchema.index({ companyId: 1, designationId: 1 });
employeeProfileSchema.index({ companyId: 1, managerId: 1 });
employeeProfileSchema.index({ companyId: 1, status: 1, isDeleted: 1 });
employeeProfileSchema.index({ employeeId: 'text', officialEmail: 'text', phone: 'text' });

module.exports = mongoose.model('EmployeeProfile', employeeProfileSchema);
