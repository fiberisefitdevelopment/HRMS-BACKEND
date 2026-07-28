const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const { COLLECTIONS, SCHEDULER_JOB_STATUS, SCHEDULER_FREQUENCIES } = require('../../constants');

const jobExecutionLogSchema = new mongoose.Schema(
  {
    jobName: { type: String, required: true, trim: true, index: true },
    frequency: { type: String, enum: SCHEDULER_FREQUENCIES },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    status: { type: String, enum: SCHEDULER_JOB_STATUS, default: 'running' },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    attempt: { type: Number, default: 1, min: 1 },
    maxRetries: { type: Number, default: 3 },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String },
    errorStack: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { collection: COLLECTIONS.SCHEDULER_JOB_LOGS }
);

jobExecutionLogSchema.plugin(timestampsPlugin);
jobExecutionLogSchema.index({ jobName: 1, startedAt: -1 });
jobExecutionLogSchema.index({ status: 1, startedAt: -1 });

module.exports = mongoose.model('JobExecutionLog', jobExecutionLogSchema);
