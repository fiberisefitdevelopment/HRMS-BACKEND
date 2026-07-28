const BaseRepository = require('../../shared/base/base.repository');
const Company = require('./company.model');

class CompanyRepository extends BaseRepository {
  constructor() {
    super(Company);
  }

  findActiveById(id) {
    return Company.findOne({ _id: id, status: 'active' });
  }

  findAllActive() {
    return Company.find({ status: 'active' }).sort({ companyName: 1 });
  }
}

module.exports = new CompanyRepository();
