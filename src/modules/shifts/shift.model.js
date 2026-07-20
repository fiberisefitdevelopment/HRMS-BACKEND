const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const breakTimingSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['lunch', 'tea_break_1', 'tea_break_2'] },
    start: { type: String },
    end: { type: String },
    durationMinutes: { type: Number, default: 15 },
  },
  { _id: false }
);

const shiftSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompanyAttendancePolicy',
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    workingDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5],
    },
    breakTimings: [breakTimingSchema],
    gracePeriodMinutes: { type: Number },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.SHIFTS }
);

shiftSchema.plugin(timestampsPlugin);
shiftSchema.plugin(companyIsolationPlugin);
shiftSchema.index({ companyId: 1, code: 1 }, { unique: true });
shiftSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.model('Shift', shiftSchema);
