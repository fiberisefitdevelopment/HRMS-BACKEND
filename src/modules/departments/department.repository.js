const BaseRepository = require('../../shared/base/base.repository');
const Model = require('./department.model');

class DepartmentRepository extends BaseRepository {
  constructor() {
    super(Model);
  }
}

module.exports = new DepartmentRepository();
