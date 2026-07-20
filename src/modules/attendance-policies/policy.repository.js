const BaseRepository = require('../../shared/base/base.repository');
const CompanyAttendancePolicy = require('./companyAttendancePolicy.model');

class PolicyRepository extends BaseRepository {
  constructor() {
    super(CompanyAttendancePolicy);
  }

  findDefault(companyId) {
    return CompanyAttendancePolicy.findOne({ companyId, isDefault: true, status: 'active' }, null, {
      companyId,
    });
  }
}

module.exports = new PolicyRepository();
