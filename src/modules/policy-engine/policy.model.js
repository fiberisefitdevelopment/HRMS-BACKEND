const mongoose = require('mongoose');
const timestampsPlugin = require('../../database/plugins/timestamps.plugin');
const companyIsolationPlugin = require('../../database/plugins/companyIsolation.plugin');
const { COLLECTIONS, POLICY_TYPES, POLICY_STATUS } = require('../../constants');

const policySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    policyType: { type: String, enum: POLICY_TYPES, required: true, index: true },
    description: { type: String, trim: true, maxlength: 1000 },
    version: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: POLICY_STATUS, default: 'draft', index: true },
    isDefault: { type: Boolean, default: false },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    assignedDepartmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    assignedEmployeeProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeProfile' }],
    effectiveFrom: { type: Date },
    effectiveTo: { type: Date },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clonedFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { collection: COLLECTIONS.POLICIES }
);

policySchema.plugin(timestampsPlugin);
policySchema.plugin(companyIsolationPlugin);
policySchema.index({ companyId: 1, policyType: 1, status: 1 });
policySchema.index({ companyId: 1, policyType: 1, isDefault: 1 });

module.exports = mongoose.model('Policy', policySchema);
