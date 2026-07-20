const BaseRepository = require('../../shared/base/base.repository');
const Policy = require('./policy.model');

class PolicyRepository extends BaseRepository {
  constructor() {
    super(Policy);
  }

  findPublished(companyId, policyType) {
    return this.model.findOne({ companyId, policyType, status: 'published', isDefault: true }, null, { companyId });
  }
}

module.exports = new PolicyRepository();
