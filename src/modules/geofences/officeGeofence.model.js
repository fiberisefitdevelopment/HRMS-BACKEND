const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const officeGeofenceSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    radiusMeters: { type: Number, required: true, min: 10, max: 50000, default: 150 },
    address: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.OFFICE_GEOFENCES }
);

officeGeofenceSchema.plugin(timestampsPlugin);
officeGeofenceSchema.plugin(companyIsolationPlugin);
officeGeofenceSchema.index({ companyId: 1, isActive: 1 });
officeGeofenceSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model('OfficeGeofence', officeGeofenceSchema);
