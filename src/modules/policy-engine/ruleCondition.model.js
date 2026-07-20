const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, CONDITION_OPERATORS } = require('../../constants');

const ruleConditionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', required: true, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'RuleGroup', required: true, index: true },
    field: { type: String, required: true, trim: true },
    operator: { type: String, enum: CONDITION_OPERATORS, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    order: { type: Number, default: 0 },
  },
  { collection: COLLECTIONS.RULE_CONDITIONS }
);

ruleConditionSchema.plugin(timestampsPlugin);
ruleConditionSchema.plugin(companyIsolationPlugin);
ruleConditionSchema.index({ ruleId: 1, groupId: 1, order: 1 });

module.exports = mongoose.model('RuleCondition', ruleConditionSchema);
