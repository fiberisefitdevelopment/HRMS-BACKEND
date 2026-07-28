const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, RULE_ACTION_TYPES } = require('../../constants');

const ruleActionSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rule', required: true, index: true },
    actionType: { type: String, enum: RULE_ACTION_TYPES, required: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    order: { type: Number, default: 0 },
  },
  { collection: COLLECTIONS.RULE_ACTIONS }
);

ruleActionSchema.plugin(timestampsPlugin);
ruleActionSchema.plugin(companyIsolationPlugin);
ruleActionSchema.index({ ruleId: 1, order: 1 });

module.exports = mongoose.model('RuleAction', ruleActionSchema);
