const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const holidaySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    holidayName: { type: String, required: true, trim: true },
    holidayDate: { type: Date, required: true, index: true },
    description: { type: String, trim: true, default: '' },
    holidayCode: { type: String, trim: true },
    location: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { collection: COLLECTIONS.HOLIDAYS }
);

holidaySchema.plugin(timestampsPlugin);
holidaySchema.plugin(companyIsolationPlugin);
holidaySchema.index({ companyId: 1, holidayDate: 1, holidayName: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);
