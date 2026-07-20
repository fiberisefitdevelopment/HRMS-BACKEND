const BaseRepository = require('../../shared/base/base.repository');
const Model = require('./manager.model');

class ManagerRepository extends BaseRepository {
  constructor() {
    super(Model);
  }
}

module.exports = new ManagerRepository();
