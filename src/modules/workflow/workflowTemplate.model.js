const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, WORKFLOW_TYPES } = require('../../constants');

const workflowTemplateSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    workflowType: { type: String, enum: WORKFLOW_TYPES, required: true, index: true },
    description: { type: String, trim: true, maxlength: 500 },
    version: { type: Number, default: 1, min: 1 },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active' },
    config: {
      approvalMode: { type: String, enum: ['sequential', 'parallel'], default: 'sequential' },
      autoApproval: { enabled: { type: Boolean, default: false }, conditions: { type: mongoose.Schema.Types.Mixed } },
      autoRejection: { enabled: { type: Boolean, default: false }, conditions: { type: mongoose.Schema.Types.Mixed } },
      reminderHours: { type: [Number], default: [24, 48, 72] },
      parallelApproval: { type: Boolean, default: false },
      sequentialApproval: { type: Boolean, default: true },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.WORKFLOW_TEMPLATES }
);

workflowTemplateSchema.plugin(timestampsPlugin);
workflowTemplateSchema.plugin(companyIsolationPlugin);
workflowTemplateSchema.index({ companyId: 1, workflowType: 1, status: 1 });
workflowTemplateSchema.index({ companyId: 1, workflowType: 1, isDefault: 1 });

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
