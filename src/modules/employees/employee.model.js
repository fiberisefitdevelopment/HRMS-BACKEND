const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, EMPLOYMENT_TYPES, EMPLOYMENT_STATUS } = require('../../constants');

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber: { type: String, trim: true, select: false },
    bankName: { type: String, trim: true },
    ifscCode: { type: String, trim: true, uppercase: true },
    branch: { type: String, trim: true },
  },
  { _id: false }
);

const personalInfoSchema = new mongoose.Schema(
  {
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    bloodGroup: { type: String, trim: true },
    maritalStatus: { type: String, enum: ['single', 'married', 'divorced', 'widowed'] },
    nationality: { type: String, trim: true, default: 'Indian' },
    aadharNumber: { type: String, trim: true, select: false },
    panNumber: { type: String, trim: true, uppercase: true, select: false },
  },
  { _id: false }
);

const contactInfoSchema = new mongoose.Schema(
  {
    personalEmail: { type: String, trim: true, lowercase: true },
    personalPhone: { type: String, trim: true },
    emergencyContactName: { type: String, trim: true },
    emergencyContactPhone: { type: String, trim: true },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    employeeCode: {
      type: String,
      required: [true, 'Employee code is required'],
      uppercase: true,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    designationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Designation',
    },
    reportingManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
    joiningDate: { type: Date, required: true },
    confirmationDate: { type: Date },
    terminationDate: { type: Date },
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      default: 'full_time',
    },
    status: {
      type: String,
      enum: EMPLOYMENT_STATUS,
      default: 'active',
    },
    workLocation: { type: String, trim: true },
    personalInfo: personalInfoSchema,
    contactInfo: contactInfoSchema,
    bankDetails: bankDetailsSchema,
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: COLLECTIONS.EMPLOYEES }
);

employeeSchema.plugin(timestampsPlugin);
employeeSchema.plugin(companyIsolationPlugin);
employeeSchema.index({ companyId: 1, employeeCode: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, userId: 1 }, { unique: true });
employeeSchema.index({ companyId: 1, departmentId: 1 });
employeeSchema.index({ companyId: 1, designationId: 1 });
employeeSchema.index({ companyId: 1, reportingManagerId: 1 });
employeeSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
