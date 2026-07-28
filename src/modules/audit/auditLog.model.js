const mongoose = require('mongoose');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../../constants');

const auditLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    /** User affected by the action (e.g. leave requester when a manager approves). */
    subjectUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: AUDIT_ACTIONS,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed },
      after: { type: mongoose.Schema.Types.Mixed },
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { collection: COLLECTIONS.AUDIT_LOGS }
);

auditLogSchema.plugin(companyIsolationPlugin);
auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, entityType: 1, entityId: 1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, subjectUserId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
