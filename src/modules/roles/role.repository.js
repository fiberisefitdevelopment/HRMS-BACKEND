const BaseRepository = require('../../shared/base/base.repository');
const Role = require('./role.model');

class RoleRepository extends BaseRepository {
  constructor() {
    super(Role);
  }

  findAllActive() {
    return Role.find({ isActive: true })
      .populate('permissions', 'name slug module action')
      .sort({ hierarchy: -1 });
  }

  findBySlug(slug) {
    return Role.findOne({ slug, isSystem: true }).populate('permissions', 'slug');
  }
}

module.exports = new RoleRepository();
