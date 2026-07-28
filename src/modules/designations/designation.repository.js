const BaseRepository = require('../../shared/base/base.repository');
const Model = require('./designation.model');

class DesignationRepository extends BaseRepository {
  constructor() {
    super(Model);
  }
}

module.exports = new DesignationRepository();
