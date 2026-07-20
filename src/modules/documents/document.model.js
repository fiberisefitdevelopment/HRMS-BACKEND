const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, DOCUMENT_CATEGORIES } = require('../../constants');

const documentSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      enum: ['employee', 'company', 'leave', 'payroll', 'other'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Entity ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
      maxlength: 255,
    },
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    fileSize: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: DOCUMENT_CATEGORIES,
      default: 'other',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: COLLECTIONS.DOCUMENTS }
);

documentSchema.plugin(timestampsPlugin);
documentSchema.plugin(companyIsolationPlugin);
documentSchema.index({ companyId: 1, entityType: 1, entityId: 1 });
documentSchema.index({ companyId: 1, category: 1 });
documentSchema.index({ companyId: 1, uploadedBy: 1 });
documentSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
