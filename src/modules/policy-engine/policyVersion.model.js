const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, POLICY_STATUS } = require('../../constants');

const policyVersionSchema = new mongoose.Schema(
  {
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    status: { type: String, enum: POLICY_STATUS, default: 'draft' },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    changelog: { type: String, trim: true },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    archivedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.POLICY_VERSIONS }
);

policyVersionSchema.plugin(timestampsPlugin);
policyVersionSchema.plugin(companyIsolationPlugin);
policyVersionSchema.index({ policyId: 1, version: -1 }, { unique: true });

module.exports = mongoose.model('PolicyVersion', policyVersionSchema);
