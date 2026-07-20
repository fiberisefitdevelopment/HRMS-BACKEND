const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, LOGICAL_OPERATORS } = require('../../constants');

const ruleGroupSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', required: true, index: true },
    parentGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'RuleGroup' },
    logicalOperator: { type: String, enum: LOGICAL_OPERATORS, default: 'and' },
    order: { type: Number, default: 0 },
    isRoot: { type: Boolean, default: false },
  },
  { collection: COLLECTIONS.RULE_GROUPS }
);

ruleGroupSchema.plugin(timestampsPlugin);
ruleGroupSchema.plugin(companyIsolationPlugin);
ruleGroupSchema.index({ ruleId: 1, parentGroupId: 1, order: 1 });

module.exports = mongoose.model('RuleGroup', ruleGroupSchema);
