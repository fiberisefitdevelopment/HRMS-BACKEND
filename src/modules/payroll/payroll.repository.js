const BaseRepository = require('../../shared/base/base.repository');
const Model = require('./payroll.model');

class PayrollRepository extends BaseRepository {
  constructor() {
    super(Model);
  }
}

module.exports = new PayrollRepository();
