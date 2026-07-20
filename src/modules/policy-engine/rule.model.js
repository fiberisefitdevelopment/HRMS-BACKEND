const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const {
  COLLECTIONS,
  RULE_TYPES,
  RULE_STATUS,
  RULE_PRIORITIES,
  RULE_EXECUTION_MODES,
} = require('../../constants');

const ruleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', index: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    ruleType: { type: String, enum: RULE_TYPES, required: true, index: true },
    description: { type: String, trim: true, maxlength: 1000 },
    version: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: RULE_STATUS, default: 'draft', index: true },
    priority: { type: String, enum: RULE_PRIORITIES, default: 'medium' },
    priorityOrder: { type: Number, default: 2 },
    isEnabled: { type: Boolean, default: true },
    executionMode: { type: String, enum: RULE_EXECUTION_MODES, default: 'sequential' },
    stopOnFailure: { type: Boolean, default: false },
    continueOnFailure: { type: Boolean, default: true },
    rootGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'RuleGroup' },
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    schedule: { type: mongoose.Schema.Types.Mixed },
    clonedFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule' },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.RULES }
);

ruleSchema.plugin(timestampsPlugin);
ruleSchema.plugin(companyIsolationPlugin);
ruleSchema.index({ companyId: 1, ruleType: 1, status: 1, priorityOrder: 1 });
ruleSchema.index({ companyId: 1, policyId: 1, isEnabled: 1 });

module.exports = mongoose.model('Rule', ruleSchema);
