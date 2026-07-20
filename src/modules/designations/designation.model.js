const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const designationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Designation name is required'],
      trim: true,
      maxlength: 150,
    },
    code: {
      type: String,
      required: [true, 'Designation code is required'],
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    level: { type: Number, default: 1, min: 1 },
    description: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
  },
  { collection: COLLECTIONS.DESIGNATIONS }
);

designationSchema.plugin(timestampsPlugin);
designationSchema.plugin(companyIsolationPlugin);
designationSchema.index({ companyId: 1, code: 1 }, { unique: true });
designationSchema.index({ companyId: 1, isActive: 1 });
designationSchema.index({ companyId: 1, level: 1 });

module.exports = mongoose.model('Designation', designationSchema);
