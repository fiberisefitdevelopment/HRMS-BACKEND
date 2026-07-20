const mongoose = require('mongoose');
const { COLLECTIONS } = require('../../constants');

const ruleLogSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    executionId: { type: mongoose.Schema.Types.ObjectId, ref: 'RuleExecution', required: true, index: true },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', index: true },
    ruleName: { type: String },
    module: { type: String, index: true },
    affectedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    executionResult: { type: mongoose.Schema.Types.Mixed, default: {} },
    executionTimeMs: { type: Number },
    dryRun: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { collection: COLLECTIONS.RULE_LOGS }
);

ruleLogSchema.index({ companyId: 1, createdAt: -1 });
ruleLogSchema.index({ companyId: 1, ruleId: 1 });

module.exports = mongoose.model('RuleLog', ruleLogSchema);
