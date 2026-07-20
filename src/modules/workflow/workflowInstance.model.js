const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, WORKFLOW_TYPES, WORKFLOW_STATUS } = require('../../constants');

const levelStateSchema = new mongoose.Schema(
  {
    levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowLevel', required: true },
    levelOrder: { type: Number, required: true },
    name: { type: String, required: true },
    approverType: { type: String, required: true },
    assignedApproverIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    approvedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'skipped', 'escalated', 'delegated'], default: 'pending' },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    dueAt: { type: Date },
    reminderSentAt: [{ type: Date }],
  },
  { _id: false }
);

const workflowInstanceSchema = new mongoose.Schema(
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
    },
    workflowType: { type: String, enum: WORKFLOW_TYPES, required: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    currentLevelOrder: { type: Number, default: 1 },
    currentApproverIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: WORKFLOW_STATUS, default: 'pending', index: true },
    contextData: { type: mongoose.Schema.Types.Mixed, default: {} },
    levelStates: [levelStateSchema],
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    lastReminderAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
  },
  { collection: COLLECTIONS.WORKFLOW_INSTANCES }
);

workflowInstanceSchema.plugin(timestampsPlugin);
workflowInstanceSchema.plugin(companyIsolationPlugin);
workflowInstanceSchema.index({ companyId: 1, entityType: 1, entityId: 1 }, { unique: true });
workflowInstanceSchema.index({ companyId: 1, status: 1, currentLevelOrder: 1 });
workflowInstanceSchema.index({ companyId: 1, requesterId: 1, status: 1 });
workflowInstanceSchema.index({ companyId: 1, currentApproverIds: 1, status: 1 });
workflowInstanceSchema.index({ companyId: 1, workflowType: 1, createdAt: -1 });

module.exports = mongoose.model('WorkflowInstance', workflowInstanceSchema);
