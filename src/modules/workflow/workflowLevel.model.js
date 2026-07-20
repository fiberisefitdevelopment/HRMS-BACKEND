const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, APPROVER_TYPES, APPROVAL_MODES } = require('../../constants');

const workflowLevelSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkflowTemplate',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    levelOrder: { type: Number, required: true, min: 1 },
    approverType: { type: String, enum: APPROVER_TYPES, required: true },
    approverUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approverRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    approvalMode: { type: String, enum: APPROVAL_MODES, default: 'sequential' },
    isRequired: { type: Boolean, default: true },
    canSkip: { type: Boolean, default: false },
    escalationHours: { type: Number, min: 0 },
    escalateToLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowLevel' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { collection: COLLECTIONS.WORKFLOW_LEVELS }
);

workflowLevelSchema.plugin(timestampsPlugin);
workflowLevelSchema.plugin(companyIsolationPlugin);
workflowLevelSchema.index({ templateId: 1, levelOrder: 1 });
workflowLevelSchema.index({ companyId: 1, templateId: 1, status: 1 });

module.exports = mongoose.model('WorkflowLevel', workflowLevelSchema);
