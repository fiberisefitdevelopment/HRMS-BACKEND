const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, CONDITION_OPERATORS } = require('../../constants');

const workflowConditionSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowTemplate', required: true, index: true },
    name: { type: String, required: true, trim: true },
    field: { type: String, required: true, trim: true },
    operator: { type: String, enum: CONDITION_OPERATORS, required: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    action: { type: String, enum: ['add_level', 'require_level', 'skip_level', 'switch_template'], default: 'add_level' },
    targetLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowLevel' },
    insertLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowLevel' },
    insertAfterOrder: { type: Number },
    switchTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowTemplate' },
    priority: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { collection: COLLECTIONS.WORKFLOW_CONDITIONS }
);

workflowConditionSchema.plugin(timestampsPlugin);
workflowConditionSchema.plugin(companyIsolationPlugin);
workflowConditionSchema.index({ templateId: 1, isActive: 1, priority: -1 });

module.exports = mongoose.model('WorkflowCondition', workflowConditionSchema);
