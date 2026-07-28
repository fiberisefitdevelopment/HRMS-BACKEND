const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const { COLLECTIONS } = require('../../constants');

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    refreshTokenVersion: {
      type: Number,
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    deviceInfo: {
      userAgent: { type: String },
      platform: { type: String },
      browser: { type: String },
    },
    ipAddress: { type: String },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { collection: COLLECTIONS.SESSIONS }
);

sessionSchema.plugin(timestampsPlugin);
sessionSchema.index({ userId: 1, isRevoked: 1 });
sessionSchema.index({ refreshTokenHash: 1 });

module.exports = mongoose.model('Session', sessionSchema);
