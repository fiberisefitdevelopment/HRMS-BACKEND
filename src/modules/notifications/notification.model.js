const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, NOTIFICATION_TYPES } = require('../../constants');

const notificationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'info',
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    actionUrl: { type: String, trim: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    expiresAt: { type: Date },
  },
  { collection: COLLECTIONS.NOTIFICATIONS }
);

notificationSchema.plugin(timestampsPlugin);
notificationSchema.plugin(companyIsolationPlugin);
notificationSchema.index({ companyId: 1, userId: 1, isRead: 1 });
notificationSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

module.exports = mongoose.model('Notification', notificationSchema);
