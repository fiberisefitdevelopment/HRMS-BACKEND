const BaseRepository = require('../../shared/base/base.repository');
const Permission = require('./permission.model');

class PermissionRepository extends BaseRepository {
  constructor() {
    super(Permission);
  }

  findAll() {
    return Permission.find().sort({ module: 1, action: 1 });
  }
}

module.exports = new PermissionRepository();
