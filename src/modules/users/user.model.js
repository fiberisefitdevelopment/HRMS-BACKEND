const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const { COLLECTIONS, USER_STATUS } = require('../../constants');

const userSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 100,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    fullName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
      minlength: 5,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: [true, 'Role is required'],
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
    },
    accessibleCompanyIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
      },
    ],
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
    profilePhoto: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    blockedReason: { type: String, trim: true, maxlength: 500 },
    blockedAt: { type: Date },
    lockedUntil: { type: Date },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lastLogin: { type: Date },
    passwordChangedAt: { type: Date },
    refreshTokenVersion: { type: Number, default: 0 },
    status: {
      type: String,
      enum: USER_STATUS,
      default: 'active',
    },
    isEmailVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { collection: COLLECTIONS.USERS }
);

userSchema.pre('save', function setFullName(next) {
  if (this.isModified('firstName') || this.isModified('lastName')) {
    this.fullName = [this.firstName, this.lastName].filter(Boolean).join(' ').trim();
  }
  next();
});

userSchema.plugin(timestampsPlugin);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ employeeCode: 1 });
userSchema.index({ companyId: 1 });
userSchema.index({ roleId: 1 });
userSchema.index({ companyId: 1, employeeCode: 1 }, { unique: true, sparse: true });
userSchema.index({ isActive: 1, isBlocked: 1 });
userSchema.index({ firstName: 'text', lastName: 'text', fullName: 'text', email: 'text' });

module.exports = mongoose.model('User', userSchema);
