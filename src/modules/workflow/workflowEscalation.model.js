const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, APPROVER_TYPES } = require('../../constants');

const workflowEscalationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowTemplate', required: true, index: true },
    levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowLevel', required: true },
    escalateAfterHours: { type: Number, required: true, min: 1 },
    escalateToApproverType: { type: String, enum: APPROVER_TYPES, required: true },
    escalateToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    escalateToRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    escalateToLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowLevel' },
    isActive: { type: Boolean, default: true },
  },
  { collection: COLLECTIONS.WORKFLOW_ESCALATIONS }
);

workflowEscalationSchema.plugin(timestampsPlugin);
workflowEscalationSchema.plugin(companyIsolationPlugin);
workflowEscalationSchema.index({ templateId: 1, levelId: 1 });

module.exports = mongoose.model('WorkflowEscalation', workflowEscalationSchema);
