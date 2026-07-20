const mongoose = require('mongoose');
const { COLLECTIONS, WORKFLOW_ACTION_TYPES } = require('../../constants');

const workflowActionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    instanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkflowInstance',
      required: true,
      index: true,
    },
    levelOrder: { type: Number },
    levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowLevel' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: WORKFLOW_ACTION_TYPES, required: true },
    comment: { type: String, trim: true, maxlength: 1000 },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { collection: COLLECTIONS.WORKFLOW_ACTIONS }
);

workflowActionSchema.index({ instanceId: 1, createdAt: -1 });
workflowActionSchema.index({ companyId: 1, actorId: 1, createdAt: -1 });
workflowActionSchema.index({ companyId: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('WorkflowAction', workflowActionSchema);
