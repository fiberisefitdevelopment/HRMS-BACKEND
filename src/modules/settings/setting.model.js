const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, SETTING_CATEGORIES } = require('../../constants');

const settingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: SETTING_CATEGORIES,
    },
    key: {
      type: String,
      required: [true, 'Setting key is required'],
      trim: true,
      lowercase: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    label: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    isEncrypted: { type: Boolean, default: false },
    isEditable: { type: Boolean, default: true },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { collection: COLLECTIONS.SETTINGS }
);

settingSchema.plugin(timestampsPlugin);
settingSchema.plugin(companyIsolationPlugin);
settingSchema.index({ companyId: 1, category: 1, key: 1 }, { unique: true });
settingSchema.index({ companyId: 1, category: 1 });

module.exports = mongoose.model('Setting', settingSchema);
