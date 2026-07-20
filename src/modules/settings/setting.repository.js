const BaseRepository = require('../../shared/base/base.repository');
const Model = require('./setting.model');

class SettingRepository extends BaseRepository {
  constructor() {
    super(Model);
  }
}

module.exports = new SettingRepository();
