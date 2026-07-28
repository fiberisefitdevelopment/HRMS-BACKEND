const mongoose = require('mongoose');
const { COLLECTIONS, RULE_EXECUTION_STATUS, RULE_TYPES } = require('../../constants');

const ruleExecutionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    executionBatchId: { type: String, required: true, index: true },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', index: true },
    ruleType: { type: String, enum: RULE_TYPES, index: true },
    module: { type: String, trim: true, index: true },
    employeeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    matched: { type: Boolean, default: false },
    actionsExecuted: [{ type: String }],
    dryRun: { type: Boolean, default: false },
    status: { type: String, enum: RULE_EXECUTION_STATUS, default: 'success' },
    executionTimeMs: { type: Number, default: 0 },
    error: { type: String },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { collection: COLLECTIONS.RULE_EXECUTIONS }
);

ruleExecutionSchema.index({ companyId: 1, createdAt: -1 });
ruleExecutionSchema.index({ companyId: 1, ruleId: 1, createdAt: -1 });
ruleExecutionSchema.index({ companyId: 1, module: 1, status: 1 });

module.exports = mongoose.model('RuleExecution', ruleExecutionSchema);
