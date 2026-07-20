const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const regularizationCounterSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
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
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    count: { type: Number, default: 0, min: 0 },
  },
  { collection: COLLECTIONS.REGULARIZATION_COUNTERS }
);

regularizationCounterSchema.plugin(timestampsPlugin);
regularizationCounterSchema.plugin(companyIsolationPlugin);
regularizationCounterSchema.index(
  { companyId: 1, employeeProfileId: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model('RegularizationCounter', regularizationCounterSchema);
