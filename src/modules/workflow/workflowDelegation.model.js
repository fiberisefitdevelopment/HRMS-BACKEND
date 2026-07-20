const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS } = require('../../constants');

const workflowDelegationSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    delegatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    delegateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workflowType: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.WORKFLOW_DELEGATIONS }
);

workflowDelegationSchema.plugin(timestampsPlugin);
workflowDelegationSchema.plugin(companyIsolationPlugin);
workflowDelegationSchema.index({ companyId: 1, delegatorId: 1, isActive: 1 });
workflowDelegationSchema.index({ companyId: 1, delegateId: 1, isActive: 1 });

module.exports = mongoose.model('WorkflowDelegation', workflowDelegationSchema);
