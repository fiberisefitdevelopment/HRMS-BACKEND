const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Role name is required'],
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: [true, 'Role slug is required'],
      lowercase: true,
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
    },
    description: { type: String, trim: true, maxlength: 500 },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Permission',
      },
    ],
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    hierarchy: { type: Number, default: 0 },
  },
  { collection: COLLECTIONS.ROLES }
);

roleSchema.plugin(timestampsPlugin);
roleSchema.plugin(companyIsolationPlugin);
roleSchema.index({ slug: 1, companyId: 1 }, { unique: true });
roleSchema.index({ companyId: 1, isActive: 1 });
roleSchema.index({ isSystem: 1 });

module.exports = mongoose.model('Role', roleSchema);
