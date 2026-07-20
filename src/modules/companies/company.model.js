const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const { COLLECTIONS, COMPANY_STATUS } = require('../../constants');

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: 200,
    },
    companyCode: {
      type: String,
      required: [true, 'Company code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: addressSchema,
    logo: { type: String, trim: true },
    status: {
      type: String,
      enum: COMPANY_STATUS,
      default: 'active',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { collection: COLLECTIONS.COMPANIES }
);

companySchema.plugin(timestampsPlugin);
companySchema.index({ companyCode: 1 }, { unique: true });
companySchema.index({ status: 1 });
companySchema.index({ companyName: 'text' });

module.exports = mongoose.model('Company', companySchema);
