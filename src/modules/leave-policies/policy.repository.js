const BaseRepository = require('../../shared/base/base.repository');
const CompanyLeavePolicy = require('./companyLeavePolicy.model');

class LeavePolicyRepository extends BaseRepository {
  constructor() {
    super(CompanyLeavePolicy);
  }

  findDefault(companyId) {
    return this.model.findOne({ companyId, isDefault: true, status: 'active' }, null, { companyId });
  }

  findActiveByCompany(companyId) {
    return this.model.findOne({ companyId, status: 'active' }, null, { companyId });
  }
}

module.exports = new LeavePolicyRepository();
